import { NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { EMPTY_TASK, TaskForm } from "@/components/panel/task-form";
import { PANEL_NAV } from "@/lib/panel/nav";
import { getPanelContext } from "@/lib/panel/guard";
import { listTaskCategories } from "@/lib/panel/task-form-data";

export const metadata = { title: "Yeni görev — GençLİG Panel" };

export default async function NewPanelTaskPage() {
  const context = await getPanelContext();
  if (!context) {
    return <NoAccess message="Bu sayfa belediye personeline açıktır." />;
  }

  const categories = await listTaskCategories();

  return (
    <PanelShell
      title="GençLİG Belediye Paneli"
      subtitle={`${context.municipalityName} · yeni görev`}
      nav={PANEL_NAV}
    >
      <TaskForm initial={EMPTY_TASK} categories={categories} scope="panel" />
    </PanelShell>
  );
}
