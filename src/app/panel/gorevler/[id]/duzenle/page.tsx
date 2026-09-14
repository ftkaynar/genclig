import { notFound } from "next/navigation";

import { NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { TaskForm } from "@/components/panel/task-form";
import { PANEL_NAV } from "@/lib/panel/nav";
import { getPanelContext } from "@/lib/panel/guard";
import { listTaskCategories, loadTaskForEdit } from "@/lib/panel/task-form-data";

export const metadata = { title: "Görev düzenle — GençLİG Panel" };

export default async function EditPanelTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await getPanelContext();
  if (!context) {
    return <NoAccess message="Bu sayfa belediye personeline açıktır." />;
  }

  const { id } = await params;
  const task = await loadTaskForEdit(id);

  // RLS görevi gizlediğinde de buraya düşülüyor: başka belediyenin görevini
  // düzenlemeye çalışan personel 404 görüyor, varlığını öğrenmiyor.
  if (!task) {
    notFound();
  }

  const categories = await listTaskCategories();

  return (
    <PanelShell
      title="GençLİG Belediye Paneli"
      subtitle={`${context.municipalityName} · görev düzenle`}
      nav={PANEL_NAV}
    >
      <TaskForm initial={task} categories={categories} scope="panel" />
    </PanelShell>
  );
}
