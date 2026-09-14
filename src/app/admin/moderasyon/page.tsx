import { ModerationQueue } from "@/components/community/moderation-queue";
import { NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { listModerationQueue } from "@/lib/community/queries";
import { ADMIN_NAV } from "@/lib/panel/nav";
import { isSuperAdmin } from "@/lib/panel/guard";

export const metadata = { title: "Moderasyon — GençLİG Admin" };

export default async function AdminModerationPage() {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  const rows = await listModerationQueue();

  return (
    <PanelShell
      title="GençLİG Süper Admin"
      subtitle={`Açık rapor: ${rows.length}`}
      nav={ADMIN_NAV}
    >
      <ModerationQueue rows={rows} canMuteGlobally />
    </PanelShell>
  );
}
