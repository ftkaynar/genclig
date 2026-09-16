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
  /** Coğrafi kapsam (M33). Takımın yeri = kaptanın profil konumu. */
  scope = "turkiye",
): Promise<TeamLeaderboardRow[]> {
  const supabase = await createClient();

  const read = (p: string) =>
    supabase.rpc("leaderboard_teams", { p_period: p, p_scope: scope });

  let { data, error } = await read(period);

  /*
    'year' dönemi M30 ile geldi; migration koşmamış bir veritabanında
    leaderboard_teams onu reddediyor ve hata YUTULUYORDU — takım
    sıralaması "Bu Yıl"da hatasız ama bomboş görünüyordu. Bireysel
    sıralamayla aynı geri düşme (bkz. lib/leaderboard/queries.ts):
    yıl penceresi yoksa tüm zamanlar gösteriliyor.
  */
  if (error && period === "year" && error.message?.includes("Geçersiz dönem")) {
    ({ data, error } = await read("all"));
  }

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
