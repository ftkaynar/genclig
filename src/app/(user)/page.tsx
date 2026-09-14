import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FeaturedTask } from "@/components/home/featured-task";
import { QuickAccess } from "@/components/home/quick-access";
import { BalanceSummary } from "@/components/points/balance-summary";
import { TaskCardCompact } from "@/components/tasks/task-card-compact";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/pills";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHeader } from "@/components/user-header";
import { getMyRank } from "@/lib/leaderboard/queries";
import { listNotifications, relativeTime } from "@/lib/notifications/queries";
import { formatPoints, getTodayEarnings, getUserPoints } from "@/lib/points/queries";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getSubmissionMap, listFeedTasks } from "@/lib/tasks/queries";
import { getViewerProfile, getViewerUser } from "@/lib/auth/viewer";

// Kullanıcı PWA ana ekranı. Route group "(user)" URL'e yansımaz, "/" olarak servis edilir.

async function loadViewer() {
  // Env tanımlı değilse (örneğin ilk kurulum) sayfa yine de açılsın.
  if (!hasSupabaseEnv()) {
    return null;
  }

  // Kullanıcı ve profil istek başına önbellekli; aynı istekte başka
  // sorgular da bunları istediğinde ağa tekrar çıkılmıyor.
  const [user, profile] = await Promise.all([
    getViewerUser(),
    getViewerProfile(),
  ]);

  if (!user) {
    return null;
  }

  return {
    user,
    username: profile?.username ?? null,
    displayName: profile?.display_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
  };
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
              className="mt-7 block w-full rounded-full bg-cta px-6 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90"
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

  const [points, today, allTasks, notifications, myRank, friendRank] =
    await Promise.all([
      getUserPoints(viewer.user.id),
      getTodayEarnings(viewer.user.id),
      listFeedTasks(),
      listNotifications(3),
      getMyRank("ilce", "week"),
      getMyRank("arkadaslar", "week"),
    ]);

  const submissions = await getSubmissionMap(allTasks.map((task) => task.id));

  const open = allTasks.filter((task) => !submissions.has(task.id));

  /*
    Öne çıkan görev: bitişi en yakın, henüz gönderilmemiş anlık görev.
    Aciliyeti olan tek görev bu; öneriler şeridinde kaybolmasın diye ayrı
    bir bantta duruyor. Bitiş tarihi olmayan görevler aday değil — "öne
    çıkan"ın anlamı burada "yakında kapanıyor".
  */
  const featured =
    open
      .filter((task) => task.type === "instant" && task.ends_at)
      .sort(
        (a, b) =>
          new Date(a.ends_at as string).getTime() -
          new Date(b.ends_at as string).getTime(),
      )[0] ?? null;

  /*
    Öneri sırası: önce anlık görevler (süresi dolmadan yapılmalı), sonra en
    yeniler. Kullanıcının zaten teslim ettiği görevler öneriden çıkarılıyor;
    "bugün ne yapsam" sorusuna zaten yaptığı işi göstermek işe yaramıyor.
    Öne çıkan görev de eleniyor: aynı kartı iki kez göstermek yer israfı.
  */
  const suggested = open
    .filter((task) => task.id !== featured?.id)
    .sort((a, b) => {
      if (a.type === b.type) return 0;
      return a.type === "instant" ? -1 : 1;
    })
    .slice(0, 5);

  const greetingName = viewer.displayName ?? viewer.username;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHeader signedIn />

      <main className="flex-1 px-4 pb-4">
        {/* Hero: selamlama + avatar + seviye halkası. */}
        <section className="brand-gradient mt-3 rounded-3xl px-5 py-5 shadow-lg">
          <div className="flex items-center gap-3">
            {viewer.avatarUrl ? (
              <Image
                src={viewer.avatarUrl}
                alt=""
                width={44}
                height={44}
                className="h-11 w-11 rounded-full border-2 border-white/30 object-cover"
                unoptimized
              />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/30 bg-white/15 text-base font-bold text-white">
                {(greetingName ?? "?").charAt(0).toUpperCase()}
              </span>
            )}

            <div className="min-w-0">
              <p className="text-xs text-white/70">Merhaba,</p>
              <p className="truncate text-lg font-bold text-white">
                {greetingName}
              </p>
            </div>
          </div>

          <BalanceSummary
            points={points}
            todayXp={today.xp}
            todayCoin={today.coin}
          />
        </section>

        <QuickAccess />

        {featured ? <FeaturedTask task={featured} /> : null}

        <section className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">
              Bugün için önerilen
            </h2>
            <Link
              href="/gorevler"
              className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
            >
              Tümünü gör
              <Icon name="chevron-right" className="h-3.5 w-3.5" />
            </Link>
          </div>

          {suggested.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                icon="list-checks"
                title="Şimdilik yeni görev yok"
                description="Açık görevlerin hepsini gönderdin. Yeni görevler eklendiğinde burada görünecek."
              />
            </div>
          ) : (
            // Yatay şerit: mobilde dikey liste ana sayfayı gereğinden uzun
            // yapıyordu; kaydırmalı şerit üç kartı da ilk ekranda tutuyor.
            <ul className="mt-3 -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
              {suggested.map((task) => (
                <TaskCardCompact key={task.id} task={task} />
              ))}
            </ul>
          )}
        </section>

        {/* Şehrin için bildir — gradyan kenarlı vurgu kartı. */}
        <Link
          href="/bildir"
          className="mt-4 flex items-center gap-3 rounded-2xl border border-primary/50 bg-card p-4 transition-colors hover:border-primary active:scale-[0.99]"
        >
          <span className="brand-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white">
            <Icon name="megaphone" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">
              Şehrin için bildir
            </span>
            <span className="block text-[11px] text-ink-muted">
              Sorun, öneri ya da proje · +25 XP • +10 Coin
            </span>
          </span>
          <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-ink-muted" />
        </Link>

        {/*
          Sıralama mini: ilçe ve arkadaşlar yan yana. Tek kapsam göstermek
          kullanıcıya "iyi miyim" sorusunun yalnız yarısını yanıtlıyordu;
          arkadaş sırası daha küçük ve motive edici bir ölçek.

          Arkadaş kapsamı çağıranın kendisini de içerdiği için arkadaşı
          olmayan kullanıcı "#1 · 1 kişi" görüyordu; scope_size 1 iken kart
          yerine arkadaş ekleme daveti gösteriliyor.
        */}
        {myRank || friendRank ? (
          <section className="mt-5 grid grid-cols-2 gap-2">
            {myRank ? (
              <Link
                href="/siralama?kapsam=ilce&donem=week"
                className="rounded-2xl border border-edge bg-card p-3.5 transition-colors hover:border-primary/60"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-xp/15 text-xp">
                  <Icon name="trophy" className="h-4.5 w-4.5" />
                </span>
                <span className="mt-2 block text-sm font-semibold text-ink">
                  İlçende #{myRank.rank}
                </span>
                <span className="block text-[11px] text-ink-muted">
                  {formatPoints(myRank.total_xp)} XP · {myRank.scope_size} kişi
                </span>
              </Link>
            ) : null}

            {friendRank && friendRank.scope_size > 1 ? (
              <Link
                href="/siralama?kapsam=arkadaslar&donem=week"
                className="rounded-2xl border border-edge bg-card p-3.5 transition-colors hover:border-primary/60"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Icon name="users" className="h-4.5 w-4.5" />
                </span>
                <span className="mt-2 block text-sm font-semibold text-ink">
                  Arkadaşlarında #{friendRank.rank}
                </span>
                <span className="block text-[11px] text-ink-muted">
                  {formatPoints(friendRank.total_xp)} XP ·{" "}
                  {friendRank.scope_size} kişi
                </span>
              </Link>
            ) : (
              <Link
                href="/arkadaslar"
                className="rounded-2xl border border-dashed border-edge bg-card p-3.5 transition-colors hover:border-primary/60"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Icon name="users" className="h-4.5 w-4.5" />
                </span>
                <span className="mt-2 block text-sm font-semibold text-ink">
                  Arkadaş ekle
                </span>
                <span className="block text-[11px] text-ink-muted">
                  Aranızda sıralama açılsın
                </span>
              </Link>
            )}
          </section>
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
                  className="flex items-start gap-2.5 rounded-xl border border-edge bg-card px-3.5 py-2.5"
                >
                  <Icon
                    name="bell"
                    className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">
                      {item.title}
                    </span>
                    <span className="block text-[11px] text-ink-muted">
                      {relativeTime(item.created_at)}
                    </span>
                  </span>
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
