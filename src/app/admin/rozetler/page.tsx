import { NoAccess } from "@/components/panel/panel-shell";
import { AdminShell } from "@/components/panel/admin-shell";
import { BadgeCreator } from "@/components/panel/admin-editors";
import { BadgeStatusButton } from "@/components/panel/archive-controls";
import { isSuperAdmin } from "@/lib/panel/guard";
import { criteriaText } from "@/lib/profile/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Rozetler — GençLİG Admin" };

export default async function AdminBadgesPage() {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("badges")
    .select("id,slug,name,description,criteria,xp_bonus,coin_bonus,status")
    .order("sort");

  const badges = (data ?? []) as {
    id: string;
    slug: string;
    name: string;
    description: string;
    criteria: Record<string, unknown>;
    xp_bonus: number;
    coin_bonus: number;
    status: string;
  }[];

  return (
    <AdminShell subtitle={`${badges.length} rozet`}>
      <div className="mb-4">
        <BadgeCreator />
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {badges.map((badge) => (
          <li
            key={badge.id}
            className="rounded-2xl border border-edge bg-card p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink">
                {badge.name}
              </span>
              <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-muted">
                {badge.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">{badge.description}</p>
            <p className="mt-1.5 text-[11px] text-ink-muted">
              {badge.slug} · {criteriaText(badge.criteria)} · +{badge.xp_bonus} XP
              / +{badge.coin_bonus} Coin
            </p>

            <div className="mt-2.5">
              <BadgeStatusButton badgeId={badge.id} status={badge.status} />
            </div>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
