import "server-only";

import webpush from "web-push";

import { createServiceClient } from "@/lib/supabase/service";

/*
  Sunucudan web push gönderimi.

  SINIRLAMA — bilinçli: push YALNIZCA uygulama sunucusundan akan
  eylemlerde gönderiliyor. Doğrudan SQL'den yapılan işlemler (elle
  düzeltme, psql, Studio) bildirim tablosuna satır yazar ama push
  ÜRETMEZ. Sebep: push göndermek için VAPID özel anahtarı ve dış ağ
  erişimi gerekiyor; Postgres'ten HTTP çağırmak pg_net gerektiriyor ve
  veritabanına dış bağımlılık sokuyordu. Bildirim zaten DB'de duruyor,
  kullanıcı uygulamayı açtığında görüyor — push yalnızca hızlandırıcı.

  Abonelikler service_role ile okunuyor: RLS kullanıcıyı kendi
  satırlarıyla sınırlıyor ve sunucunun BAŞKASININ aboneliğine yazması
  gerekiyor (görevi onaylayan personel, bildirimi alan kullanıcı).
*/

let configured = false;
let warned = false;

/** VAPID yapılandırması eksikse push sessizce devre dışı. */
function ensureConfigured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    /*
      TEK uyarı: her gönderim denemesinde yazsaydı log gürültüye
      dönerdi. Sessizce kapalı kalmak da yanlış — ortam değişkenlerini
      eklemeyi unutan geliştirici hiçbir iz göremiyordu (D32 FAZ D3).
    */
    if (!warned) {
      warned = true;
      console.warn(
        "[push] VAPID ortam değişkenleri eksik; bildirim gönderimi kapalı. " +
          "Gerekenler: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.",
      );
    }
    return false;
  }

  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Bir kullanıcının TÜM cihazlarına push gönderir.
 *
 * Asla fırlatmıyor: push bir yan etki, asıl işlemi (görev onayı, duyuru)
 * kırmamalı. Hatalar log'a yazılıyor.
 *
 * 404/410 dönen abonelik SİLİNİYOR — tarayıcı aboneliği iptal etmiş
 * demektir ve ölü kayıtlar her gönderimde gereksiz istek üretir.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  if (!ensureConfigured()) {
    return { sent: 0, removed: 0 };
  }

  const supabase = createServiceClient();
  if (!supabase) {
    console.warn("[push] service client yok, gönderim atlandı");
    return { sent: 0, removed: 0 };
  }

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", userId);

  if (error) {
    console.error("[push] abonelikler okunamadı:", error);
    return { sent: 0, removed: 0 };
  }

  const subs = data ?? [];
  let sent = 0;
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
        );
        sent += 1;
      } catch (err) {
        const status =
          err && typeof err === "object" && "statusCode" in err
            ? Number((err as { statusCode: unknown }).statusCode)
            : 0;

        if (status === 404 || status === 410) {
          dead.push(sub.id);
        } else {
          console.error("[push] gönderim hatası:", status, err);
        }
      }
    }),
  );

  if (dead.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", dead);
  }

  return { sent, removed: dead.length };
}

/**
 * Çok sayıda kullanıcıya push (duyuru).
 *
 * Gruplar hâlinde gidiyor: 500+ hedefte hepsini aynı anda başlatmak hem
 * bellek hem de push servislerinin oran sınırları açısından sorunlu.
 * Hata yutulmuyor ama akışı da kırmıyor — sayılar dönüyor.
 */
export async function sendPushToMany(
  userIds: string[],
  payload: PushPayload,
  batchSize = 50,
): Promise<{ sent: number; removed: number }> {
  let sent = 0;
  let removed = 0;

  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((id) => sendPushToUser(id, payload)),
    );
    for (const r of results) {
      sent += r.sent;
      removed += r.removed;
    }
  }

  return { sent, removed };
}
