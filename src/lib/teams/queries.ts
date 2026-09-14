import { createClient } from "@/lib/supabase/server";

export type MyTeam = {
  team_id: string;
  name: string;
  icon: string | null;
  invite_code: string;
  captain_id: string;
  max_members: number;
  member_count: number;
  my_role: "captain" | "member";
};

export type TeamMemberRow = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  role: "captain" | "member";
  level: number;
  weekly_xp: number;
};

export type TeamLeaderboardRow = {
  rank: number;
  team_id: string;
  team_name: string;
  icon: string | null;
  member_count: number;
  total_xp: number;
};

/*
  Takım verileri security definer fonksiyonlardan geliyor: teams ve
  team_members üzerindeki RLS kullanıcıya yalnızca kendi takımını gösteriyor,
  üyelerin profilleri ise profiles RLS'i altında görünmez. Sıralama tanımı
  gereği bütün takımları kapsıyor, o da definer.
*/

export async function getMyTeam(): Promise<MyTeam | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_team");
  const rows = (data ?? []) as MyTeam[];
  return rows[0] ?? null;
}

export async function getMyTeamMembers(): Promise<TeamMemberRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_team_members");
  return (data ?? []) as TeamMemberRow[];
}

export async function getTeamLeaderboard(
  period: string,
): Promise<TeamLeaderboardRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("leaderboard_teams", {
    p_period: period,
  });
  return (data ?? []) as TeamLeaderboardRow[];
}

/**
 * Takım görevlerinde aynı dönemde kaç takım arkadaşının görevi
 * tamamladığı — görev kimliğine göre.
 *
 * security definer RPC'den geliyor: RLS kullanıcıya yalnızca kendi
 * teslimlerini gösterdiği için takım arkadaşlarının teslimleri normal
 * sorguyla sayılamıyor (aynı sınıf sorun D07/D08'de ölçülmüştü).
 * Takımı olmayan kullanıcıda boş harita döner.
 */
export async function getTeamTaskProgress(
  taskIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (taskIds.length === 0) return result;

  const supabase = await createClient();
  const { data } = await supabase.rpc("team_task_progress", {
    p_task_ids: taskIds,
  });

  for (const row of (data ?? []) as { task_id: string; done: number }[]) {
    result.set(row.task_id, row.done);
  }
  return result;
}
