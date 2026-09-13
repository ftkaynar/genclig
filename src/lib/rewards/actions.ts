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
    return {
      error: known.some((needle) => error.message.includes(needle))
        ? error.message
        : "Ödül alınamadı. Lütfen tekrar dene.",
    };
  }

  revalidatePath("/oduller");
  revalidatePath("/oduller/kuponlarim");
  revalidatePath("/", "layout");

  return { code: (data as { code?: string } | null)?.code };
}
