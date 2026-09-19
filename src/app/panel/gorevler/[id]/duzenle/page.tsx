import { notFound } from "next/navigation";

import { NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { TaskForm } from "@/components/panel/task-form";
import { PANEL_NAV } from "@/lib/panel/nav";
import { getPanelContext } from "@/lib/panel/guard";
import { getProvinces } from "@/lib/reference/queries";
import {
  listTaskCategories,
  loadQuizForEdit,
  loadTaskForEdit,
} from "@/lib/panel/task-form-data";

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
  // Quiz görevinde mevcut sorular forma yükleniyor (doğru şık dahil —
  // soruyu yazan personel düzenleyecek).
  const quiz =
    task?.verification === "quiz" ? await loadQuizForEdit(id) : [];

  // RLS görevi gizlediğinde de buraya düşülüyor: başka belediyenin görevini
  // düzenlemeye çalışan personel 404 görüyor, varlığını öğrenmiyor.
  if (!task) {
    notFound();
  }

  const [categories, provinces] = await Promise.all([
    listTaskCategories(),
    getProvinces(),
  ]);

  return (
    <PanelShell
      title="GençLİG Belediye Paneli"
      subtitle={`${context.municipalityName} · görev düzenle`}
      nav={PANEL_NAV}
    >
      <TaskForm
        initial={task}
        initialQuiz={quiz}
        categories={categories}
        provinces={provinces}
        scope="panel"
      />
    </PanelShell>
  );
}
