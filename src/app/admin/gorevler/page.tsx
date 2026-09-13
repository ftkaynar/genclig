import { NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { TaskStatusControls } from "@/components/panel/task-status-controls";
import { ADMIN_NAV } from "@/lib/panel/nav";
import { isSuperAdmin } from "@/lib/panel/guard";
import { listPanelTasks } from "@/lib/panel/queries";
import { TASK_TYPE_LABEL, VERIFICATION_LABEL } from "@/lib/tasks/labels";

export const metadata = { title: "Görevler — GençLİG Admin" };

const STATUS_LABEL: Record<string, string> = {
  draft: "Taslak",
  active: "Yayında",
  paused: "Duraklatıldı",
  archived: "Arşiv",
};

export default async function AdminTasksPage() {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  // null = global görevler; belediye görevleri kendi panelinde yönetiliyor.
  const tasks = await listPanelTasks(null);

  return (
    <PanelShell
      title="GençLİG Süper Admin"
      subtitle={`${tasks.length} global görev`}
      nav={ADMIN_NAV}
    >
      <ul className="flex flex-col gap-3">
        {tasks.map((task) => (
          <li key={task.id} className="rounded-2xl border border-edge bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-ink-muted">
                {TASK_TYPE_LABEL[task.type] ?? task.type} ·{" "}
                {VERIFICATION_LABEL[task.verification] ?? task.verification} · +
                {task.xp} XP / +{task.coin} Coin
              </span>
              <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink">
                {STATUS_LABEL[task.status] ?? task.status}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-semibold text-ink">{task.title}</p>
            <TaskStatusControls taskId={task.id} current={task.status} />
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}
