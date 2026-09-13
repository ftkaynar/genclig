import { NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { ReportList } from "@/components/panel/report-list";
import { ADMIN_NAV } from "@/lib/panel/nav";
import { isSuperAdmin } from "@/lib/panel/guard";
import { listPanelReports } from "@/lib/panel/queries";

export const metadata = { title: "Bildirimler — GençLİG Admin" };

export default async function AdminReportsPage() {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  // null = belediye filtresi yok; süper admin hepsini görür.
  const reports = await listPanelReports(null);

  return (
    <PanelShell
      title="GençLİG Süper Admin"
      subtitle={`Tüm bildirimler: ${reports.length}`}
      nav={ADMIN_NAV}
    >
      <ReportList reports={reports} />
    </PanelShell>
  );
}
