import { KpiCard, NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { PANEL_NAV } from "@/lib/panel/nav";
import { getPanelContext } from "@/lib/panel/guard";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Belediye Paneli — GençLİG",
};

export default async function PanelPage() {
  const context = await getPanelContext();

  if (!context) {
    return (
      <NoAccess message="Belediye paneline yalnızca belediye yöneticileri ve operatörleri girebilir. Yetkin olması gerekiyorsa belediyenin yöneticisiyle görüş." />
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("panel_kpis", {
    p_municipality_id: context.municipalityId,
  });

  const kpi = (Array.isArray(data) ? data[0] : data) as
    | {
        active_tasks: number;
        pending_reviews: number;
        approved_submissions: number;
        participants: number;
        reports_new: number;
        reports_in_progress: number;
        reports_resolved: number;
      }
    | undefined;

  return (
    <PanelShell
      title="GençLİG Belediye Paneli"
      subtitle={context.municipalityName}
      nav={PANEL_NAV}
    >
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Aktif görev" value={kpi?.active_tasks ?? 0} />
        <KpiCard
          label="Bekleyen inceleme"
          value={kpi?.pending_reviews ?? 0}
          tone={kpi && kpi.pending_reviews > 0 ? "warning" : "ink"}
        />
        <KpiCard
          label="Onaylı teslim"
          value={kpi?.approved_submissions ?? 0}
          tone="primary"
        />
        <KpiCard label="Katılımcı" value={kpi?.participants ?? 0} />
      </section>

      <h2 className="mt-6 text-sm font-semibold text-ink">
        Şehir bildirimleri
      </h2>
      <section className="mt-3 grid grid-cols-3 gap-3">
        <KpiCard
          label="Yeni"
          value={kpi?.reports_new ?? 0}
          tone={kpi && kpi.reports_new > 0 ? "danger" : "ink"}
        />
        <KpiCard label="İşlemde" value={kpi?.reports_in_progress ?? 0} tone="warning" />
        <KpiCard label="Çözüldü" value={kpi?.reports_resolved ?? 0} tone="primary" />
      </section>
    </PanelShell>
  );
}
