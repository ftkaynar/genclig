import { createClient } from "@/lib/supabase/server";

export type LeaderboardRow = {
  rank: number;
  user_id: string;
  username: string;
  level: number;
  total_xp: number;
};

export type MyRank = {
  rank: number;
  total_xp: number;
  scope_size: number;
} | null;

export const SCOPES = [
  { key: "turkiye", label: "Türkiye" },
  { key: "il", label: "İl" },
  { key: "ilce", label: "İlçe" },
  { key: "mahalle", label: "Mahalle" },
  { key: "arkadaslar", label: "Arkadaşlar" },
  // Takım kapsamı farklı bir satır şekli döndürüyor (kullanıcı değil takım);
  // sayfa bu anahtarda ayrı bir dala giriyor, leaderboard_top çağrılmıyor.
  { key: "takimlar", label: "Takımlar" },
] as const;

export const PERIODS = [
  { key: "week", label: "Bu Hafta" },
  { key: "month", label: "Bu Ay" },
  { key: "all", label: "Tümü" },
] as const;

/*
  Sıralama security definer fonksiyonlardan geliyor: RLS kullanıcıya yalnızca
  kendi işlemlerini gösterdiği için normal sorguyla sıralama üretilemez.
  Fonksiyonlar yalnızca kullanıcı adı, seviye ve dönem XP'si döndürüyor.
*/
export async function getLeaderboard(
  scope: string,
  period: string,
): Promise<LeaderboardRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("leaderboard_top", {
    p_scope: scope,
    p_period: period,
    p_limit: 50,
  });
  return (data ?? []) as LeaderboardRow[];
}

export async function getMyRank(scope: string, period: string): Promise<MyRank> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("leaderboard_my_rank", {
    p_scope: scope,
    p_period: period,
  });
  const rows = (data ?? []) as NonNullable<MyRank>[];
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}
