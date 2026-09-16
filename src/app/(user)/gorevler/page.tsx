import Link from "next/link";

import { TaskTile } from "@/components/tasks/task-tile";
import { Icon } from "@/components/ui/icon";
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

  const filtered = activeTab
    ? scopeTasks.filter((task) => task.type === activeTab)
    : scopeTasks;

  /*
    Yaklaşan görevler ayrı bir bölümde ve başlangıç saatine göre sıralı.
    Aynı listede karışık dursalardı "şimdi yapabileceğim" ile "iki gün
    sonra başlayacak" arasındaki fark kaybolurdu; kullanıcı aktif bir
    göreve dokunmak isterken başlamamış olana giriyordu.
  */
  const upcoming = filtered
    .filter((task) => task.timeState === "upcoming")
    .sort(
      (a, b) =>
        new Date(a.starts_at as string).getTime() -
        new Date(b.starts_at as string).getTime(),
    );

  const tasks = filtered.filter((task) => task.timeState !== "upcoming");

  const teamTaskIds = filtered
    .filter((task) => task.scope === "team")
    .map((task) => task.id);

  const [submissions, teamProgress] = await Promise.all([
    getSubmissionMap(filtered.map((task) => task.id)),
    getTeamTaskProgress(teamTaskIds),
  ]);

  return (
    /*
      Izgara geniş ekranda 3-4 sütuna çıkıyor; kap max-w-md kalsaydı
      sütunlar hiç genişlemezdi. Diğer ekranlar telefon genişliğinde
      kalıyor, yalnız görev ızgarası genişliyor.
    */
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface sm:max-w-3xl lg:max-w-5xl">
      <UserHud title="Görevler" />

      {/* Teslim takibi görev listesinin hemen üstünde: kullanıcı görev
          gönderdikten sonra "ne oldu" sorusunu burada soruyor. */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <div className="min-w-0 flex-1">
          <ScopeSwitch activeScope={activeScope} activeTab={activeTab} />
        </div>
        <Link
          href="/gorevlerim"
          className="flex shrink-0 items-center gap-1 rounded-full border border-edge bg-card px-3 py-2 text-xs font-medium text-ink-muted hover:text-ink"
        >
          <Icon name="list-checks" className="h-4 w-4" />
          Görevlerim
        </Link>
      </div>

      <div className="mt-2.5 px-4">
        <TypeChips
          counts={counts}
          activeTab={activeTab}
          activeScope={activeScope}
        />
      </div>

      <main className="flex-1 px-4 py-4 has-bottom-nav">
        {upcoming.length > 0 ? (
          <section className="mb-5">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-indigo">
              <Icon name="calendar-clock" className="h-4 w-4" />
              Yaklaşan
            </h2>
            <ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
              {upcoming.map((task, i) => (
                <TaskTile
                  key={task.id}
                  task={task}
                  submission={submissions.get(task.id)}
                  teamCount={teamProgress.get(task.id)}
                  index={i}
                />
              ))}
            </ul>
          </section>
        ) : null}

        {tasks.length === 0 ? (
          upcoming.length === 0 ? (
            /*
              Boş durum teşvik edici: "görev yok" bir çıkmaz gibi
              okunuyordu. Metin kullanıcıyı kartını parlatmaya çağırıyor
              ve Keşfet'e çıkış veriyor — boş ekran hep bir sonraki
              adımı göstermeli.
            */
            <EmptyState
              icon="sparkles"
              title="Burada henüz görev yok"
              description="İlk görevini tamamla, kartını parlatmaya başla! Keşfet'te yakınındaki görevlere bak."
              action={
                <Link
                  href="/kesfet"
                  className="btn-chunky bg-cta inline-block rounded-full px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Keşfet&apos;e git
                </Link>
              }
            />
          ) : null
        ) : (
          <>
            {upcoming.length > 0 ? (
              <h2 className="mb-2 text-sm font-semibold text-ink">Şimdi açık</h2>
            ) : null}
            <ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
              {tasks.map((task, i) => (
                <TaskTile
                  key={task.id}
                  task={task}
                  submission={submissions.get(task.id)}
                  teamCount={teamProgress.get(task.id)}
                  index={i}
                />
              ))}
            </ul>
          </>
        )}
      </main>

      <UserBottomNav active="tasks" />
    </div>
  );
}
