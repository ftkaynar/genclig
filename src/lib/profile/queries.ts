import { createClient } from "@/lib/supabase/server";

export type BadgeRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  criteria: Record<string, unknown>;
  icon: string | null;
  xp_bonus: number;
  coin_bonus: number;
  /** Kazanıldıysa tarih; kazanılmadıysa null. */
  earned_at: string | null;
  /**
   * Kriterdeki ilerleme. Hesaplanamayan kriter tiplerinde null —
   * uydurma bir oran göstermek kullanıcıyı yanıltırdı.
   */
  progress: { current: number; target: number } | null;
  sort: number;
  earned: boolean;
};

export type ActivityRow = {
  id: string;
  amount: number;
  reason: string;
  created_at: string;
};

export type ProfileStats = {
  approvedTasks: number;
  pendingTasks: number;
  byCategory: { name: string; count: number }[];
};

export type ProfileData = {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  province: string | null;
  district: string | null;
  neighborhood: string | null;
};

/** Rozet kriterini kullanıcıya anlatan tek satır. */
export function criteriaText(criteria: Record<string, unknown>): string {
  const type = criteria?.type;

  if (type === "total_tasks") {
    return `${criteria.count} görev tamamla`;
  }
  if (type === "category_tasks") {
    return `${criteria.category} kategorisinde ${criteria.count} görev tamamla`;
  }
  if (type === "problem_reports") {
    return `${criteria.count} bildirim gönder`;
  }
  if (type === "xp_total") {
    return `${criteria.amount} XP topla`;
  }
  return "Koşul tanımlı değil";
}

export async function getProfile(userId: string): Promise<ProfileData> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select(
      "username,display_name,avatar_url,provinces(name),districts(name),neighborhoods(name)",
    )
    .eq("id", userId)
    .maybeSingle();

  const row = data as unknown as
    | {
        username: string | null;
        display_name: string | null;
        avatar_url: string | null;
        provinces: { name: string } | null;
        districts: { name: string } | null;
        neighborhoods: { name: string } | null;
      }
    | null;

  return {
    username: row?.username ?? null,
    displayName: row?.display_name ?? null,
    avatarUrl: row?.avatar_url ?? null,
    province: row?.provinces?.name ?? null,
    district: row?.districts?.name ?? null,
    neighborhood: row?.neighborhoods?.name ?? null,
  };
}

/**
 * Tüm rozetler, kullanıcının kazandıkları işaretli.
 * Kazanılmayanlar da dönüyor: profil ekranı hedefleri göstermek için soluk
 * kartlar çiziyor.
 */
export async function getBadges(userId: string): Promise<BadgeRow[]> {
  const supabase = await createClient();

  /*
    Rozet ilerlemesi için gereken sayaçlar tek seferde toplanıyor.
    Her rozet için ayrı sorgu, rozet sayısı kadar veritabanı turu demekti.
  */
  const [{ data: all }, { data: mine }, { data: subs }, { count: reportCount }, { data: xpRows }] =
    await Promise.all([
      supabase
        .from("badges")
        .select("id,slug,name,description,criteria,icon,xp_bonus,coin_bonus,sort")
        .eq("status", "active")
        .order("sort"),
      supabase
        .from("user_badges")
        .select("badge_id,earned_at")
        .eq("user_id", userId),
      supabase
        .from("task_submissions")
        .select("status,tasks(task_categories(slug))")
        .eq("user_id", userId)
        .eq("status", "approved"),
      supabase
        .from("problem_reports")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("xp_transactions")
        .select("amount")
        .eq("user_id", userId),
    ]);

  const earnedAt = new Map(
    (mine ?? []).map((row) => [row.badge_id as string, row.earned_at as string]),
  );

  const submissions = (subs ?? []) as unknown as {
    tasks: { task_categories: { slug: string } | null } | null;
  }[];

  const totalTasks = submissions.length;

  const byCategory = new Map<string, number>();
  for (const row of submissions) {
    const slug = row.tasks?.task_categories?.slug;
    if (slug) byCategory.set(slug, (byCategory.get(slug) ?? 0) + 1);
  }

  const totalXp = (xpRows ?? []).reduce(
    (sum, row) => sum + (row.amount as number),
    0,
  );

  /*
    Desteklenen kriter tipleri badges migration'ındakiyle aynı. Tanınmayan
    bir tip gelirse ilerleme null dönüyor — uydurma bir oran göstermek
    yerine hiç göstermemek doğrusu.
  */
  function progressFor(
    criteria: Record<string, unknown>,
  ): { current: number; target: number } | null {
    const type = criteria?.type;

    if (type === "total_tasks") {
      return { current: totalTasks, target: Number(criteria.count ?? 0) };
    }
    if (type === "category_tasks") {
      const slug = String(criteria.category ?? "");
      return {
        current: byCategory.get(slug) ?? 0,
        target: Number(criteria.count ?? 0),
      };
    }
    if (type === "problem_reports") {
      return { current: reportCount ?? 0, target: Number(criteria.count ?? 0) };
    }
    if (type === "xp_total") {
      return { current: totalXp, target: Number(criteria.amount ?? 0) };
    }
    return null;
  }

  return (all ?? []).map((badge) => {
    const criteria = badge.criteria as Record<string, unknown>;
    const earned = earnedAt.has(badge.id);
    return {
      ...(badge as unknown as Omit<
        BadgeRow,
        "earned" | "earned_at" | "progress"
      >),
      earned,
      earned_at: earnedAt.get(badge.id) ?? null,
      progress: earned ? null : progressFor(criteria),
    };
  });
}

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("task_submissions")
    .select("status,tasks(task_categories(name))")
    .eq("user_id", userId);

  const rows = (data ?? []) as unknown as {
    status: string;
    tasks: { task_categories: { name: string } | null } | null;
  }[];

  const counts = new Map<string, number>();
  let approved = 0;
  let pending = 0;

  for (const row of rows) {
    if (row.status === "approved") {
      approved += 1;
      const name = row.tasks?.task_categories?.name;
      if (name) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    } else if (row.status === "pending") {
      pending += 1;
    }
  }

  return {
    approvedTasks: approved,
    pendingTasks: pending,
    byCategory: [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function getRecentActivity(
  userId: string,
  limit = 10,
): Promise<ActivityRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("xp_transactions")
    .select("id,amount,reason,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as ActivityRow[];
}

export const ACTIVITY_LABEL: Record<string, string> = {
  task: "Görev ödülü",
  badge: "Rozet bonusu",
  adjustment: "Düzeltme",
};
