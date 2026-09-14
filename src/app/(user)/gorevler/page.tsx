import { TaskCard } from "@/components/tasks/task-card";
import {
  ScopeSwitch,
  TASK_SCOPES,
  TASK_TYPE_TABS,
  TypeChips,
} from "@/components/tasks/task-filters";
import { EmptyState } from "@/components/ui/pills";
import { UserHud } from "@/components/user-hud";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { getSubmissionMap, listFeedTasks } from "@/lib/tasks/queries";
import { getTeamTaskProgress } from "@/lib/teams/queries";

export const metadata = {
  title: "Görevler — GençLİG",
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ tip?: string; kapsam?: string }>;
}) {
  const { tip, kapsam } = await searchParams;
  const activeTab = TASK_TYPE_TABS.some((tab) => tab.key === tip)
    ? (tip ?? "")
    : "";
  const activeScope = TASK_SCOPES.some((item) => item.key === kapsam)
    ? (kapsam ?? "")
    : "";

  /*
    Kapsam filtresindeki tüm görevler bir kez çekiliyor; tip sayıları
    bundan hesaplanıyor ve liste veritabanına dönmeden burada süzülüyor.

    Neden tek sorgu: her çip için ayrı bir `count` sorgusu üç ek veritabanı
    turu demekti ve görev sayısı bu ölçekte (onlarca) tek sorguyla rahat
    taşınıyor. Sayfalama eklendiğinde bu yeniden değerlendirilmeli.
  */
  const scopeTasks = await listFeedTasks(undefined, activeScope || undefined);

  const counts: Record<string, number> = {
    "": scopeTasks.length,
    continuous: scopeTasks.filter((task) => task.type === "continuous").length,
    instant: scopeTasks.filter((task) => task.type === "instant").length,
  };

  const tasks = activeTab
    ? scopeTasks.filter((task) => task.type === activeTab)
    : scopeTasks;

  const teamTaskIds = tasks
    .filter((task) => task.scope === "team")
    .map((task) => task.id);

  const [submissions, teamProgress] = await Promise.all([
    getSubmissionMap(tasks.map((task) => task.id)),
    getTeamTaskProgress(teamTaskIds),
  ]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHud title="Görevler" />

      <div className="px-4 pt-3">
        <ScopeSwitch activeScope={activeScope} activeTab={activeTab} />
      </div>

      <div className="mt-2.5 px-4">
        <TypeChips
          counts={counts}
          activeTab={activeTab}
          activeScope={activeScope}
        />
      </div>

      <main className="flex-1 px-4 py-4">
        {tasks.length === 0 ? (
          <EmptyState
            icon="list-checks"
            title="Şu an aktif görev yok"
            description="Bu filtrede görev bulunmuyor. Diğer sekmelere bakabilirsin."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                submission={submissions.get(task.id)}
                teamCount={teamProgress.get(task.id)}
              />
            ))}
          </ul>
        )}
      </main>

      <UserBottomNav active="tasks" />
    </div>
  );
}
