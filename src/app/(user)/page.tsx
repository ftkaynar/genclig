import Image from "next/image";
import { RewardFab } from "@/components/rewards/reward-fab";
import Link from "next/link";
import { redirect } from "next/navigation";

import { WelcomeScreen } from "@/components/auth/welcome-screen";
import { AnnouncementBanner } from "@/components/home/announcement-banner";
import { FeaturedTask } from "@/components/home/featured-task";
import { SpotlightBand } from "@/components/home/spotlight-band";
import { QuickAccess } from "@/components/home/quick-access";
import { ReportCta } from "@/components/home/report-cta";
import { RankCard } from "@/components/home/rank-card";
import { Arrival } from "@/components/game/arrival";
import { BalanceSummary } from "@/components/points/balance-summary";
import { PushNudge } from "@/components/notifications/push-nudge";
import { createClient } from "@/lib/supabase/server";
import { HScroll } from "@/components/ui/h-scroll";
import { TaskTile } from "@/components/tasks/task-tile";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/pills";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHud } from "@/components/user-hud";
import { getLatestAnnouncement } from "@/lib/announcements/queries";
import { getMyRank } from "@/lib/leaderboard/queries";
import { listNotifications, relativeTime } from "@/lib/notifications/queries";
import { getTodayEarnings, getUserPoints } from "@/lib/points/queries";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getSpotlightTask } from "@/lib/spotlight/queries";
import { taskCardState } from "@/lib/tasks/labels";
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
    // D24: telefon da zorunlu alan; eksikse profil tamam sayılmıyor.
    phone: profile?.phone ?? null,
    displayName: profile?.display_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
  };
}

export default async function UserHomePage() {
  const viewer = await loadViewer();

  /*
    Oturum var ama profil eksikse onboarding zorunlu.

    Telefon de bu kurala dahil (D24 FAZ F1). Mevcut kullanıcıların
    profilinde telefon yok, bu yüzden onlar da bir kez onboarding'e
    uğrayıp numaralarını giriyor — telefonu yalnızca yeni kayıtlardan
    istemek, alanı sahada işe yaramaz hâle getirirdi.
  */
  if (viewer && (!viewer.username || !viewer.phone)) {
    redirect("/onboarding");
  }

  /*
    Oturumsuz ziyaretçi: ÇIPLAK karşılama ekranı (D35 FAZ A).

    ÖNCEKİ DURUM: bu dalda UserHud, RewardFab ve UserBottomNav üçü de
    çiziliyordu (ölçüldü). Hesabı olmayan birine beş sekmeli bir
    uygulama gezinmesi göstermek hem yalan (hiçbiri çalışmıyor) hem de
    dikkat dağıtıcıydı.
  */
  if (!viewer) {
    return <WelcomeScreen />;
  }

  const [
    points,
    today,
    allTasks,
    notifications,
    turkiyeRank,
    ilRank,
    ilceRank,
    announcement,
  ] = await Promise.all([
    getUserPoints(viewer.user.id),
    getTodayEarnings(viewer.user.id),
    listFeedTasks(),
    listNotifications(3),
    /*
      Üç kapsam birden: Türkiye / İl / İlçe. Tek kapsam "iyi miyim"
      sorusunun yalnız üçte birini yanıtlıyordu; Türkiye genelinde
      nerede olduğunu görmeden ilçe sırası bağlamsız.

      Üçü paralel gidiyor, aynı RPC farklı kapsamla — sıralamayı tek
      sorguda üç kapsam için döndüren bir fonksiyon yazmak yeni bir
      RPC demekti ve bu dilim GÖRSEL (yeni DB yok).
    */
    getMyRank("turkiye", "week"),
    getMyRank("il", "week"),
    getMyRank("ilce", "week"),
    getLatestAnnouncement(),
  ]);

  /*
    Günün Görevi ayrı bir çağrı: kayıt yoksa seçimi tetikliyor ve
    yukarıdaki Promise.all'a koymak, her ana sayfa yüklemesinde
    seçim yazmayı kritik yola sokardı. Vitrin yoksa band çizilmiyor.
  */
  const spotlight = await getSpotlightTask();

  const submissions = await getSubmissionMap(allTasks.map((task) => task.id));

  /*
    Rozet SAYISI (liste değil): giriş kutlaması yalnızca "yeni rozet
    var mı" sorusunu soruyor. Rozet listesini çekmek ana sayfaya
    gereksiz bir sorgu eklerdi.
  */
  const { count: badgeCount } = await (await createClient())
    .from("user_badges")
    .select("badge_id", { count: "exact", head: true })
    .eq("user_id", viewer.user.id);

  /*
    Açık görevler: henüz dokunulmamışlar + günü yenilenmiş SÜREKLİ
    görevler (D32 FAZ G3).

    ÖNCEKİ DURUM: `!submissions.has(task.id)` — bir kez gönderilen görev
    ana sayfadan SONSUZA KADAR düşüyordu. Sürekli görevin tüm amacı
    günlük ritim kurmak; kullanıcı bir kez yürüyüş yaptıktan sonra o
    görevi bir daha ana sayfada görmüyordu ve ertesi gün geri gelmek
    için sebep kalmıyordu.

    Kural taskCardState'te: "done" ve "pending" gizleniyor, "repeat" ve
    "none" gösteriliyor. Görev günü Europe/Istanbul 06:00'da yenileniyor.
  */
  const open = allTasks.filter((task) => {
    const state = taskCardState(task.type, submissions.get(task.id));
    return state === "none" || state === "repeat";
  });

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
      <UserHud />

      <main className="flex-1 px-4 pb-4 has-bottom-nav">
        {announcement ? (
          <AnnouncementBanner announcement={announcement} />
        ) : null}

        {/* Hero: selamlama + avatar + seviye halkası. */}
        <section className="anim-stagger brand-gradient mt-3 rounded-3xl px-5 py-5 shadow-lg" style={{ "--i": 1 } as React.CSSProperties}>
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

          {/*
            Giriş anı: son görülen duruma göre kazanç sayacı ya da
            seviye/rozet kutlaması. Delta yoksa hiçbir şey basmıyor.

            D30'da bu bileşen yazıldı ama BURAYA HİÇ BAĞLANMAMIŞTI —
            "seviye atlama pop-up'ı hiç görünmedi" şikâyetinin asıl
            sebebi buydu (D32 FAZ D2'de ölçüldü).
          */}
          <PushNudge />

          <Arrival
            xp={points.xp}
            coin={points.coin}
            level={points.level}
            badges={badgeCount ?? 0}
            unlocked={[]}
          />

          <BalanceSummary
            points={points}
            todayXp={today.xp}
            todayCoin={today.coin}
          />
        </section>

        {/*
          Sıralaman kartı hızlı erişimin HEMEN ÜSTÜNDE: kullanıcı
          ekranı kaydırırken önce "neredeyim" sorusunun cevabını
          görüyor, sonra nereye gideceğini.
        */}
        <RankCard
          scopes={[
            {
              key: "turkiye",
              label: "Türkiye",
              rank: turkiyeRank?.rank ?? null,
              size: turkiyeRank?.scope_size ?? 0,
            },
            {
              key: "il",
              label: "İl",
              rank: ilRank?.rank ?? null,
              size: ilRank?.scope_size ?? 0,
            },
            {
              key: "ilce",
              label: "İlçe",
              rank: ilceRank?.rank ?? null,
              size: ilceRank?.scope_size ?? 0,
            },
          ]}
        />

        <QuickAccess />

        {/* GÜNÜN GÖREVİ — hero'nun hemen altında, öne çıkandan önce. */}
        {spotlight ? <SpotlightBand task={spotlight} /> : null}

        {featured ? <FeaturedTask task={featured} /> : null}

        <section className="anim-stagger mt-5" style={{ "--i": 2 } as React.CSSProperties}>
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
            /*
              GÖREV KUTUSU BİRLİĞİ (D30 FAZ U): ana sayfa da Görevler ve
              Keşfet ile AYNI TaskTile bileşenini kullanıyor.

              Önceden burada TaskCardCompact vardı: farklı gradyan,
              farklı ödül gösterimi, farklı zaman çipi. Aynı görev üç
              ekranda üç türlü görünüyordu ve biri güncellendiğinde
              diğerleri geride kalıyordu.
            */
            <HScroll as="ul" className="mt-3" ariaLabel="Önerilen görevler">
              {suggested.map((task, i) => (
                <TaskTile
                  key={task.id}
                  task={task}
                  index={i}
                  small
                  spotlight={task.id === spotlight?.id}
                />
              ))}
            </HScroll>
          )}
        </section>

        {/*
          Bu blok artık hero'nun hemen altında (yukarı taşındı).
          Önceden önerilen görevlerin ALTINDAYDI ve ilk ekranda hiç
          görünmüyordu; oysa "şehrin için bildir" uygulamanın sivil
          amacının merkezinde.
        */}
        <ReportCta className="mt-4" />


        {notifications.length > 0 ? (
          <section className="anim-stagger mt-5" style={{ "--i": 2 } as React.CSSProperties}>
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

      {/*
        Ödül FAB'ı ana sayfada da (D35 FAZ A bulgusu).

        ÖLÇÜLDÜ: FAB 15 kullanıcı sayfasında vardı ama GİRİŞLİ ana
        sayfada yoktu — yalnız oturumsuz dalda duruyordu. Yani
        kullanıcının en çok indiği ekranda mağaza kısayolu yoktu.
      */}
      <RewardFab />

      <UserBottomNav active="home" />
    </div>
  );
}
