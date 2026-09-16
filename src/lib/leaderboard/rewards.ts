import { createClient } from "@/lib/supabase/server";

export type RewardSetting = {
  id: string;
  scope: string;
  period: string;
  rank: number;
  xp: number;
  token: number;
  active: boolean;
};

export type RewardAward = {
  id: string;
  scope: string;
  period: string;
  period_key: string;
  rank: number;
  user_id: string | null;
  team_id: string | null;
  xp: number;
  token: number;
  created_at: string;
};

/** Bir kapsam/dönem için aktif ödül ayarları. */
export async function getRewardSettings(
  scope: string,
  period: string,
): Promise<RewardSetting[]> {
  // İl/ilçe/mahallede ödül yok; boş dönmek şeridi de gizliyor.
  if (scope !== "turkiye" && scope !== "takimlar") {
    return [];
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("leaderboard_reward_settings")
    .select("id,scope,period,rank,xp,token,active")
    .eq("scope", scope)
    .eq("period", period)
    .eq("active", true)
    .order("rank");

  return (data ?? []) as RewardSetting[];
}

/** Tüm ayarlar — yönetim ekranı için. */
export async function listAllRewardSettings(): Promise<RewardSetting[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leaderboard_reward_settings")
    .select("id,scope,period,rank,xp,token,active")
    .order("scope")
    .order("period")
    .order("rank");

  return (data ?? []) as RewardSetting[];
}

/** Geçmiş dağıtımlar — yönetim ekranı için. */
export async function listRewardAwards(limit = 100): Promise<RewardAward[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leaderboard_reward_awards")
    .select("id,scope,period,period_key,rank,user_id,team_id,xp,token,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as RewardAward[];
}

/*
  Tembel dağıtım.

  Sıralama ekranı açıldığında biten dönemleri dağıtıyor. pg_cron bulutta
  kurulu (D30'da ölçüldü ve günlük iş zamanlandı) ama bu yol EMNİYET AĞI:
  sessizce düşen bir cron job'ı fark etmek zor, kullanıcı ziyareti ise
  her gün gerçekleşiyor.

  Fonksiyon idempotent: iki yol aynı anda çalışsa da ikinci yazım
  UNIQUE kısıtına takılıyor. Hata yutuluyor — dağıtım başarısız olursa
  sıralama ekranı yine de açılmalı.
*/
export async function settleLeaderboardRewards(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("settle_leaderboard_rewards");
  if (error) {
    console.error("[siralama] dönem ödülü dağıtımı başarısız:", error);
  }
}
