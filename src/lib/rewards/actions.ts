"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type RedeemState = {
  error?: string;
  code?: string;
  title?: string;
};

/*
  Ödül alma. Tüm kurallar (stok, seviye, rozet, bakiye) redeem_reward içinde;
  burada yalnızca çağrı ve hata çevirisi var.
*/
export async function redeemRewardAction(
  rewardId: string,
): Promise<RedeemState> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("redeem_reward", {
    p_reward_id: rewardId,
  });

  if (error) {
    const known = ["alınamıyor", "tükendi", "seviyeye", "rozete", "coin"];
    /*
      "Coin" → "Token" yeniden adlandırması yalnızca kullanıcıya görünen
      metinde. `redeem_reward` fonksiyonunun hata mesajı veritabanında
      "Yeterli coin'in yok…" diyor ve bu dilimde migration yasak
      (DOKUNMA listesi), bu yüzden metin burada — gösterilmeden hemen
      önce — çevriliyor.

      Kalıcı çözüm mesajı migration'da değiştirmek; o iş bir sonraki
      şema dilimine borç yazıldı.
    */
    const message = error.message.replace(/coin/gi, "Token");

    return {
      error: known.some((needle) => error.message.includes(needle))
        ? message
        : "Ödül alınamadı. Lütfen tekrar dene.",
    };
  }

  revalidatePath("/oduller");
  revalidatePath("/oduller/kuponlarim");
  revalidatePath("/", "layout");

  return { code: (data as { code?: string } | null)?.code };
}
