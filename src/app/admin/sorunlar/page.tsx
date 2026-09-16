import { NoAccess } from "@/components/panel/panel-shell";
import { AdminShell } from "@/components/panel/admin-shell";
import { ReportList } from "@/components/panel/report-list";
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
    <AdminShell subtitle={`Tüm bildirimler: ${reports.length}`}>
      <ReportList reports={reports} />
    </AdminShell>
  );
}
