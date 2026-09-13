import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BalanceSummary } from "@/components/points/balance-summary";
import { TaskCard } from "@/components/tasks/task-card";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHeader } from "@/components/user-header";
import { getMyRank } from "@/lib/leaderboard/queries";
import { listNotifications, relativeTime } from "@/lib/notifications/queries";
import { formatPoints, getUserPoints } from "@/lib/points/queries";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getSubmissionMap, listFeedTasks } from "@/lib/tasks/queries";

// Kullanıcı PWA ana ekranı. Route group "(user)" URL'e yansımaz, "/" olarak servis edilir.

async function loadViewer() {
  // Env tanımlı değilse (örneğin ilk kurulum) sayfa yine de açılsın.
  if (!hasSupabaseEnv()) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  return { user, username: profile?.username ?? null };
}

export default async function UserHomePage() {
  const viewer = await loadViewer();

  // Oturum var ama profil eksikse onboarding zorunlu.
  if (viewer && !viewer.username) {
    redirect("/onboarding");
  }

  if (!viewer) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
        <UserHeader signedIn={false} />

        <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
          <section className="brand-gradient w-full rounded-3xl px-6 py-10 text-center shadow-lg">
            <Image
              src="/brand/logo-mark.png"
              alt="GençLİG logosu"
              width={96}
              height={96}
              className="mx-auto h-24 w-24"
              priority
            />
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-white">
              GençLİG
            </h1>
            <p className="mt-2 text-sm text-white/80">
              Şehrinde görev yap, puan kazan.
            </p>

            <Link
              href="/kayit"
              className="mt-7 block w-full rounded-full bg-cta px-6 py-3 text-base font-semibold text-brand transition-opacity hover:opacity-90"
            >
              Hemen başla
            </Link>
            <Link
              href="/giris"
              className="mt-3 block w-full rounded-full border border-white/40 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-white/10"
            >
              Giriş yap
            </Link>
          </section>
        </main>

        <UserBottomNav active="home" />
      </div>
    );
  }

  /*
    Öneri sırası: önce anlık görevler (süresi dolmadan yapılmalı), sonra en
    yeniler. Kullanıcının zaten teslim ettiği görevler öneriden çıkarılıyor;
    "bugün ne yapsam" sorusuna zaten yaptığı işi göstermek işe yaramıyor.
  */
  const [points, allTasks, notifications, myRank] = await Promise.all([
    getUserPoints(viewer.user.id),
    listFeedTasks(),
    listNotifications(3),
    getMyRank("turkiye", "week"),
  ]);

  const submissions = await getSubmissionMap(allTasks.map((task) => task.id));

  const suggested = allTasks
    .filter((task) => !submissions.has(task.id))
    .sort((a, b) => {
      if (a.type === b.type) return 0;
      return a.type === "instant" ? -1 : 1;
    })
    .slice(0, 3);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHeader signedIn />

      <main className="flex-1 px-4 py-4">
        <section className="brand-gradient rounded-3xl px-5 py-6 shadow-lg">
          <p className="text-sm text-white/80">Merhaba,</p>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {viewer.username}
          </h1>
          <BalanceSummary points={points} />
        </section>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href="/bildir"
            className="rounded-2xl border border-primary/50 bg-card px-4 py-3.5 text-center"
          >
            <span className="block text-sm font-semibold text-ink">
              Şehrin için bildir
            </span>
            <span className="mt-0.5 block text-[11px] text-ink-muted">
              +25 XP • +10 Coin
            </span>
          </Link>
          <Link
            href="/kesfet"
            className="rounded-2xl border border-edge bg-card px-4 py-3.5 text-center"
          >
            <span className="block text-sm font-semibold text-ink">Keşfet</span>
            <span className="mt-0.5 block text-[11px] text-ink-muted">
              Yakınındaki görevler
            </span>
          </Link>
        </div>

        <section className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">
              Bugün için önerilen
            </h2>
            <Link
              href="/gorevler"
              className="text-xs font-medium text-primary hover:underline"
            >
              Tümünü gör
            </Link>
          </div>

          {suggested.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-edge bg-card px-4 py-6 text-center text-sm text-ink-muted">
              Şu an önerilecek yeni görev yok.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {suggested.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </ul>
          )}
        </section>

        {myRank ? (
          <Link
            href="/siralama"
            className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-edge bg-card p-3.5"
          >
            <span>
              <span className="block text-sm font-semibold text-ink">
                Bu haftaki sıram
              </span>
              <span className="block text-[11px] text-ink-muted">
                {formatPoints(myRank.total_xp)} XP · {myRank.scope_size} kişi
                arasında
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-primary/15 px-3 py-1 text-sm font-bold text-primary">
              {myRank.rank}.
            </span>
          </Link>
        ) : null}

        {notifications.length > 0 ? (
          <section className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink">Son bildirimler</h2>
              <Link
                href="/bildirimler"
                className="text-xs font-medium text-primary hover:underline"
              >
                Tümü
              </Link>
            </div>

            <ul className="mt-3 flex flex-col gap-2">
              {notifications.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-edge bg-card px-3.5 py-2.5"
                >
                  <p className="text-sm text-ink">{item.title}</p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {relativeTime(item.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>

      <UserBottomNav active="home" />
    </div>
  );
}
