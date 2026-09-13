import { NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { PANEL_NAV } from "@/lib/panel/nav";
import { getPanelContext } from "@/lib/panel/guard";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Ödüller — GençLİG Panel" };

export default async function PanelRewardsPage() {
  const context = await getPanelContext();
  if (!context) {
    return <NoAccess message="Bu sayfa belediye personeline açıktır." />;
  }

  const supabase = await createClient();

  const [{ data: rewards }, { data: redemptions }] = await Promise.all([
    supabase
      .from("rewards")
      .select("id,title,coin_cost,min_level,stock,status")
      .eq("municipality_id", context.municipalityId)
      .order("coin_cost"),
    supabase
      .from("reward_redemptions")
      .select("id,code,status,created_at,rewards(title)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const rows = (rewards ?? []) as {
    id: string;
    title: string;
    coin_cost: number;
    min_level: number;
    stock: number | null;
    status: string;
  }[];

  const codes = (redemptions ?? []) as unknown as {
    id: string;
    code: string;
    status: string;
    created_at: string;
    rewards: { title: string } | null;
  }[];

  return (
    <PanelShell
      title="GençLİG Belediye Paneli"
      subtitle={context.municipalityName}
      nav={PANEL_NAV}
    >
      <h2 className="text-sm font-semibold text-ink">Belediye ödülleri</h2>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-ink-muted">
          Bu belediyeye tanımlı ödül yok. Ödül tanımlama formu sonraki dilimde
          gelecek; şimdilik süper admin ekleyebilir.
        </p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {rows.map((reward) => (
            <li
              key={reward.id}
              className="rounded-2xl border border-edge bg-card p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">
                  {reward.title}
                </span>
                <span className="rounded-full bg-coin/15 px-2.5 py-1 text-xs font-semibold text-coin">
                  {reward.coin_cost}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Seviye {reward.min_level}
                {reward.stock !== null ? ` · stok ${reward.stock}` : null} ·{" "}
                {reward.status}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-6 text-sm font-semibold text-ink">Son kuponlar</h2>
      {codes.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-edge bg-card px-4 py-6 text-center text-sm text-ink-muted">
          Henüz kupon yok.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {codes.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-card px-3.5 py-2.5"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-ink">
                  {item.rewards?.title ?? "Ödül"}
                </span>
                <span className="block font-mono text-xs text-ink-muted">
                  {item.code}
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-ink-muted">
                {item.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}
