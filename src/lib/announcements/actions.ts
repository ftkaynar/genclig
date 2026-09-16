"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { sendPushToMany } from "@/lib/push/send";

export type AnnouncementState = { error?: string; notice?: string };

/*
  Duyuru gönderimi. Yetki kuralı (süper admin her hedef, personel yalnızca
  kendi belediyesi) RPC'nin içinde; buradaki tek iş çağrı ve hata çevirisi.
*/
function translate(message: string): string {
  const known = [
    "Başlık en az",
    "Duyuru metni en az",
    "Geçersiz hedef",
    "kendi belediyenin",
    "duyuru gönderme yetkin yok",
    "Belediye seçilmedi",
    "Kullanıcı bulunamadı",
    "giriş yapmalısın",
  ];
  return known.some((needle) => message.includes(needle))
    ? message
    : "İşlem tamamlanamadı. Lütfen tekrar dene.";
}

export async function sendAnnouncementAction(input: {
  title: string;
  body: string;
  audience: string;
  municipalityId?: string | null;
  username?: string | null;
}): Promise<AnnouncementState> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("send_announcement", {
    p_title: input.title.trim(),
    p_body: input.body.trim(),
    p_audience: input.audience,
    p_municipality: input.municipalityId || null,
    p_username: input.username?.trim() || null,
  });

  if (error) return { error: translate(error.message) };

  revalidatePath("/admin/duyurular");
  revalidatePath("/panel/duyurular");

  const count = typeof data === "number" ? data : 0;

  /*
    Duyuru push'u: hedef kullanıcıları bildirim tablosundan okuyoruz.

    send_announcement kimlere gönderdiğini döndürmüyor (yalnız sayı),
    ve hedef kuralını (belediye/ilçe/kullanıcı) burada yeniden
    yazmak, kuralın iki yerde ayrışması demekti. Bunun yerine az önce
    yazılan bildirim satırlarından alıcıları okuyoruz — tek doğruluk
    kaynağı RPC'nin kendisi.

    sendPushToMany gruplar hâlinde gidiyor; 500+ hedefte hepsini aynı
    anda başlatmak push servislerinin oran sınırına takılıyordu.
  */
  if (count > 0) {
    const { data: targets } = await supabase
      .from("notifications")
      .select("user_id")
      .eq("type", "announcement")
      .gte("created_at", new Date(Date.now() - 60_000).toISOString())
      .limit(5000);

    const ids = [...new Set((targets ?? []).map((row) => row.user_id as string))];
    if (ids.length > 0) {
      await sendPushToMany(ids, {
        title: input.title.trim(),
        body: input.body.trim().slice(0, 120),
        url: "/bildirimler",
        tag: "announcement",
      });
    }
  }

  return { notice: `Duyuru ${count} kişiye gönderildi.` };
}
