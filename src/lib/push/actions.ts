"use server";

import { createClient } from "@/lib/supabase/server";

/*
  Push aboneliği kayıt/silme.

  Abonelik satırı KULLANICININ KENDİ oturumuyla yazılıyor (service_role
  değil): RLS `user_id = auth.uid()` şartını zaten uyguluyor ve böylece
  bir kullanıcı başkasının adına abonelik kaydedemiyor.

  endpoint tekil; aynı tarayıcı yeniden abone olduğunda satır
  güncelleniyor (upsert) — mükerrer kayıt aynı bildirimi iki kez
  göndermek demek olurdu.
*/

export type SubscribeInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function savePushSubscriptionAction(
  input: SubscribeInput,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Önce giriş yapmalısın." };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    console.error("[push] abonelik kaydedilemedi:", error);
    return { error: "Bildirim aboneliği kaydedilemedi." };
  }

  return {};
}

export async function removePushSubscriptionAction(
  endpoint: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  if (error) {
    console.error("[push] abonelik silinemedi:", error);
    return { error: "Bildirim aboneliği kapatılamadı." };
  }

  return {};
}
