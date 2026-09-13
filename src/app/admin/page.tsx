import { KpiCard, NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { ADMIN_NAV } from "@/lib/panel/nav";
import { isSuperAdmin } from "@/lib/panel/guard";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Süper Admin — GençLİG" };

export default async function AdminPage() {
  if (!(await isSuperAdmin())) {
    return (
      <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_kpis");

  const kpi = (Array.isArray(data) ? data[0] : data) as
    | {
        users_total: number;
        municipalities_total: number;
        tasks_total: number;
        pending_reviews: number;
        reports_total: number;
        reports_open: number;
        redemptions_total: number;
      }
    | undefined;

  return (
    <PanelShell title="GençLİG Süper Admin" nav={ADMIN_NAV}>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Kullanıcı" value={kpi?.users_total ?? 0} />
        <KpiCard label="Belediye" value={kpi?.municipalities_total ?? 0} />
        <KpiCard label="Görev" value={kpi?.tasks_total ?? 0} />
        <KpiCard
          label="Bekleyen inceleme"
          value={kpi?.pending_reviews ?? 0}
          tone={kpi && kpi.pending_reviews > 0 ? "warning" : "ink"}
        />
        <KpiCard label="Toplam bildirim" value={kpi?.reports_total ?? 0} />
        <KpiCard
          label="Açık bildirim"
          value={kpi?.reports_open ?? 0}
          tone={kpi && kpi.reports_open > 0 ? "danger" : "ink"}
        />
        <KpiCard
          label="Kupon"
          value={kpi?.redemptions_total ?? 0}
          tone="primary"
        />
      </section>
    </PanelShell>
  );
}
