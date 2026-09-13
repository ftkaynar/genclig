import { NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { RewardCreator } from "@/components/panel/admin-editors";
import { ADMIN_NAV } from "@/lib/panel/nav";
import { isSuperAdmin } from "@/lib/panel/guard";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Ödüller — GençLİG Admin" };

export default async function AdminRewardsPage() {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("rewards")
    .select("id,title,coin_cost,min_level,stock,status,municipality_id")
    .order("coin_cost");

  const rewards = (data ?? []) as {
    id: string;
    title: string;
    coin_cost: number;
    min_level: number;
    stock: number | null;
    status: string;
    municipality_id: string | null;
  }[];

  return (
    <PanelShell
      title="GençLİG Süper Admin"
      subtitle={`${rewards.length} ödül`}
      nav={ADMIN_NAV}
    >
      <div className="mb-4">
        <RewardCreator />
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {rewards.map((reward) => (
          <li key={reward.id} className="rounded-2xl border border-edge bg-card p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink">{reward.title}</span>
              <span className="rounded-full bg-coin/15 px-2.5 py-1 text-xs font-semibold text-coin">
                {reward.coin_cost}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-ink-muted">
              Seviye {reward.min_level}
              {reward.stock !== null ? ` · stok ${reward.stock}` : " · sınırsız"} ·{" "}
              {reward.municipality_id ? "belediye" : "global"} · {reward.status}
            </p>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}
