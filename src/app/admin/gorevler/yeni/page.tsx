import { NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { EMPTY_TASK, TaskForm } from "@/components/panel/task-form";
import { ADMIN_NAV } from "@/lib/panel/nav";
import { isSuperAdmin } from "@/lib/panel/guard";
import { listTaskCategories } from "@/lib/panel/task-form-data";

export const metadata = { title: "Yeni global görev — GençLİG Admin" };

export default async function NewAdminTaskPage() {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  const categories = await listTaskCategories();

  return (
    <PanelShell
      title="GençLİG Süper Admin"
      subtitle="Yeni global görev (tüm belediyelerde görünür)"
      nav={ADMIN_NAV}
    >
      <TaskForm initial={EMPTY_TASK} categories={categories} scope="admin" />
    </PanelShell>
  );
}
