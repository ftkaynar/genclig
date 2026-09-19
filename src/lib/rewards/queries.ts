import { createClient } from "@/lib/supabase/server";
import { getViewerUser } from "@/lib/auth/viewer";
import { getBadgeNames as getCachedBadgeNames } from "@/lib/reference/queries";

export type RewardRow = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  coin_cost: number;
  min_level: number;
  required_badge_id: string | null;
  stock: number | null;
  municipality_id: string | null;
  /** FAB'daki "YENİ" rozeti bu alandan besleniyor (D35 FAZ F). */
  created_at: string | null;
};

export type RedemptionRow = {
  id: string;
  code: string;
  status: string;
  created_at: string;
  used_at: string | null;
  rewards: { title: string; coin_cost: number } | null;
};

export const REDEMPTION_STATUS_LABEL: Record<string, string> = {
  active: "Kullanılabilir",
  used: "Kullanıldı",
  cancelled: "İptal edildi",
};

export async function listRewards(): Promise<RewardRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rewards")
    .select(
      "id,title,description,image_url,coin_cost,min_level,required_badge_id,stock,municipality_id,created_at",
    )
    .eq("status", "active")
    .order("coin_cost");
  return (data ?? []) as RewardRow[];
}

/**
 * Ödül başına alınmış kupon sayısı.
 * Stok göstergesi için; reward_redemptions RLS'i kullanıcıya yalnızca kendi
 * kuponlarını gösterdiği için buradan gelen sayı eksik olabilir. Bu yüzden
 * arayüz "kalan stok" değil yalnızca "stoklu ödül" bilgisini gösteriyor.
 */
export async function listMyRedemptions(): Promise<RedemptionRow[]> {
  const supabase = await createClient();
  const user = await getViewerUser();
  if (!user) return [];

  const { data } = await supabase
    .from("reward_redemptions")
    .select("id,code,status,created_at,used_at,rewards(title,coin_cost)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []) as unknown as RedemptionRow[];
}

export async function getMyBadgeIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const user = await getViewerUser();
  if (!user) return new Set();

  const { data } = await supabase
    .from("user_badges")
    .select("badge_id")
    .eq("user_id", user.id);

  return new Set((data ?? []).map((row) => row.badge_id));
}

export async function getBadgeNames(): Promise<Map<string, string>> {
  // Rozet adları kullanıcıya göre değişmiyor; referans önbelleğinden.
  const rows = await getCachedBadgeNames();
  return new Map(rows.map((row) => [row.id, row.name]));
}
