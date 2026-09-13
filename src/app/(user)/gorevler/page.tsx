import Link from "next/link";

import { TaskCard } from "@/components/tasks/task-card";
import { UserHeader } from "@/components/user-header";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { getSubmissionMap, getViewer, listFeedTasks } from "@/lib/tasks/queries";

export const metadata = {
  title: "Görevler — GençLİG",
};

/*
  Sekmeler URL üzerinden (?tip=). Neden client state değil: sayfa sunucuda
  render ediliyor ve filtre sorguya giriyor; state'te tutulsaydı ya tüm
  görevleri çekip istemcide elemek ya da sayfayı client'a taşımak gerekirdi.
  URL ayrıca paylaşılabilir ve geri tuşuyla çalışıyor.
*/
const TABS = [
  { key: "", label: "Tümü" },
  { key: "continuous", label: "Sürekli" },
  { key: "instant", label: "Anlık" },
] as const;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ tip?: string }>;
}) {
  const { tip } = await searchParams;
  const activeTab = TABS.some((tab) => tab.key === tip) ? (tip ?? "") : "";

  const viewer = await getViewer();
  const tasks = await listFeedTasks(activeTab || undefined);
  const submissions = await getSubmissionMap(tasks.map((task) => task.id));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHeader title="Görevler" signedIn={Boolean(viewer)} />

      <nav aria-label="Görev türü" className="px-4 pt-4">
        <ul className="flex gap-2">
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <li key={tab.key || "all"}>
                <Link
                  href={tab.key ? `/gorevler?tip=${tab.key}` : "/gorevler"}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive
                      ? "block rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-brand"
                      : "block rounded-full border border-edge bg-card px-3.5 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
                  }
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="flex-1 px-4 py-4">
        {tasks.length === 0 ? (
          <p className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-ink-muted">
            Şu an aktif görev yok.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                submission={submissions.get(task.id)}
              />
            ))}
          </ul>
        )}
      </main>

      <UserBottomNav active="tasks" />
    </div>
  );
}
