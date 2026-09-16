import Image from "next/image";
import { RewardFab } from "@/components/rewards/reward-fab";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Icon } from "@/components/ui/icon";
import { EmptyState, IconBadge } from "@/components/ui/pills";
import { TaskReward } from "@/components/ui/task-reward";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHud } from "@/components/user-hud";
import { getViewerUser } from "@/lib/auth/viewer";
import {
  SUBMISSION_TABS,
  type SubmissionTab,
} from "@/lib/submissions/labels";
import {
  listMySubmissions,
  signSubmissionPhotos,
} from "@/lib/submissions/queries";

export const metadata = {
  title: "Görevlerim — GençLİG",
};

function shortDate(value: string): string {
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function MySubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string }>;
}) {
  const user = await getViewerUser();

  if (!user) {
    redirect("/giris?next=/gorevlerim");
  }

  const { durum } = await searchParams;
  const active: SubmissionTab = SUBMISSION_TABS.some(
    (tab) => tab.key === durum,
  )
    ? (durum as SubmissionTab)
    : "pending";

  /*
    Sayımlar için tüm teslimler bir kez çekiliyor; sekme listesi bundan
    süzülüyor. Her sekme için ayrı sorgu üç veritabanı turu demekti ve
    kullanıcı başına teslim sayısı bu ölçekte tek sorguyla rahat taşınıyor.
  */
  const all = await listMySubmissions();
  const rows = all.filter((row) => row.status === active);
  const photos = await signSubmissionPhotos(rows);

  const counts = {
    pending: all.filter((row) => row.status === "pending").length,
    approved: all.filter((row) => row.status === "approved").length,
    rejected: all.filter((row) => row.status === "rejected").length,
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHud title="Görevlerim" />

      <nav aria-label="Teslim durumu" className="px-4 pt-3">
        <ul className="flex gap-2">
          {SUBMISSION_TABS.map((tab) => {
            const isActive = tab.key === active;
            return (
              <li key={tab.key} className="flex-1">
                <Link
                  href={`/gorevlerim?durum=${tab.key}`}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center justify-center gap-1.5 rounded-full px-2.5 py-2 text-xs font-semibold ${
                    isActive
                      ? "brand-gradient text-white"
                      : "border border-edge bg-card text-ink-muted"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`rounded-full px-1.5 text-[10px] font-bold ${
                      isActive ? "bg-white/25" : "bg-surface"
                    }`}
                  >
                    {counts[tab.key]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="flex-1 px-4 py-4 has-bottom-nav">
        {rows.length === 0 ? (
          <EmptyState
            icon="list-checks"
            title={
              active === "pending"
                ? "İncelemede teslimin yok"
                : active === "approved"
                  ? "Henüz onaylanan teslimin yok"
                  : "Reddedilen teslimin yok"
            }
            description="Görev gönderdiğinde durumu burada takip edebilirsin."
            action={
              <Link
                href="/gorevler"
                className="btn-chunky bg-cta inline-block rounded-full px-5 py-2.5 text-sm font-semibold text-white"
              >
                Görevlere git
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => {
              const photoUrl = photos.get(row.id);

              return (
                <li
                  key={row.id}
                  className="rounded-2xl border border-edge bg-card p-3.5"
                >
                  <Link
                    href={`/gorevler/${row.task_id}`}
                    className="flex gap-3"
                  >
                    <IconBadge icon={row.task_icon} size="card" />

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">
                        {row.task_title}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink-muted">
                        {shortDate(row.created_at)} gönderildi
                      </span>

                      {row.status === "approved" ? (
                        <TaskReward
                          xp={row.xp}
                          coin={row.coin}
                          size="md"
                          className="mt-1.5"
                        />
                      ) : null}
                    </span>

                    {photoUrl ? (
                      <Image
                        src={photoUrl}
                        alt=""
                        width={52}
                        height={52}
                        className="h-13 w-13 shrink-0 rounded-xl object-cover"
                        style={{ width: 52, height: 52 }}
                        unoptimized
                      />
                    ) : null}
                  </Link>

                  {row.status === "rejected" && row.reject_reason ? (
                    <p className="mt-2.5 flex items-start gap-1.5 rounded-xl bg-status-danger/10 px-3 py-2 text-[11px] text-status-danger">
                      <Icon
                        name="x"
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      />
                      <span>
                        <strong>Reddedilme sebebi:</strong> {row.reject_reason}
                      </span>
                    </p>
                  ) : null}

                  {row.status === "pending" ? (
                    <p className="mt-2.5 text-[11px] text-ink-muted">
                      Belediye ekibi incelemesi bekleniyor.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <RewardFab />


      <UserBottomNav active="tasks" />
    </div>
  );
}
