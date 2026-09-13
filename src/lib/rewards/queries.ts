import { createClient } from "@/lib/supabase/server";

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
      "id,title,description,image_url,coin_cost,min_level,required_badge_id,stock,municipality_id",
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data } = await supabase
    .from("user_badges")
    .select("badge_id")
    .eq("user_id", user.id);

  return new Set((data ?? []).map((row) => row.badge_id));
}

export async function getBadgeNames(): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("badges").select("id,name");
  return new Map((data ?? []).map((row) => [row.id, row.name]));
}
