import { NoAccess } from "@/components/panel/panel-shell";
import { AdminShell } from "@/components/panel/admin-shell";
import { EMPTY_TASK, TaskForm } from "@/components/panel/task-form";
import { isSuperAdmin } from "@/lib/panel/guard";
import { getProvinces } from "@/lib/reference/queries";
import { listTaskCategories } from "@/lib/panel/task-form-data";

export const metadata = { title: "Yeni global görev — GençLİG Admin" };

export default async function NewAdminTaskPage() {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  const [categories, provinces] = await Promise.all([
    listTaskCategories(),
    getProvinces(),
  ]);

  return (
    <AdminShell subtitle="Yeni global görev (tüm belediyelerde görünür)">
      <TaskForm
        initial={EMPTY_TASK}
        categories={categories}
        provinces={provinces}
        scope="admin"
      />
    </AdminShell>
  );
}
