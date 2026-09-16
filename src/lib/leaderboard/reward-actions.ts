"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/*
  Sıralama ödülü ayarlarının yönetimi.

  Yetki kontrolü BURADA DEĞİL, leaderboard_reward_settings RLS
  politikasında (lrs_write_super). Kuralı arayüze kopyalamak, gerçek
  kuralla arayüzün zamanla ayrışması demekti — bu ilke D14'ten beri aynı.
*/

export type RewardSettingState = { error?: string; notice?: string };

export async function updateRewardSettingAction(
  id: string,
  values: { xp: number; token: number; active: boolean },
): Promise<RewardSettingState> {
  if (values.xp < 0 || values.token < 0) {
    return { error: "Miktarlar negatif olamaz." };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("leaderboard_reward_settings")
    .update(
      { xp: values.xp, token: values.token, active: values.active },
      { count: "exact" },
    )
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  /*
    RLS reddi hata DÖNDÜRMÜYOR, yalnızca 0 satır günceller. Sayıyı
    kontrol etmeseydik yetkisiz kullanıcı "kaydedildi" mesajı görürdü —
    sessiz başarısızlık, D29'da inceleme kuyruğunda tam olarak bunu
    ölçmüştük.
  */
  if (!count) {
    return { error: "Bu ayarı değiştirme yetkin yok." };
  }

  revalidatePath("/admin/siralama-odulleri");
  revalidatePath("/siralama");
  return { notice: "Ödül ayarı güncellendi." };
}
