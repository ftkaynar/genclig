import Image from "next/image";
import Link from "next/link";

import { Arrival } from "@/components/game/arrival";
import { redirect } from "next/navigation";

import { BadgeGrid } from "@/components/profile/badge-grid";
import { FlipCard } from "@/components/card/flip-card";
import { Icon } from "@/components/ui/icon";
import { LevelPath, type LevelNode } from "@/components/profile/level-path";
import { LevelRing } from "@/components/ui/level-ring";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHud } from "@/components/user-hud";
import { formatPoints, getUserPoints } from "@/lib/points/queries";
import {
  ACTIVITY_LABEL,
  criteriaText,
  getBadges,
  getProfile,
  getProfileStats,
  getRecentActivity,
} from "@/lib/profile/queries";
import { relativeTime } from "@/lib/notifications/queries";
import { getViewerUser } from "@/lib/auth/viewer";
import {
  getLevels,
  getRewardMilestones,
  getXpBadgeThresholds,
} from "@/lib/reference/queries";
import { getMyStats } from "@/lib/stats/queries";
import { listFriends } from "@/lib/social/queries";
import { listMyReports } from "@/lib/problems/queries";

export const metadata = {
  title: "Profil — GençLİG",
};

export default async function ProfilePage() {
  const user = await getViewerUser();

  if (!user) {
    redirect("/giris?next=/profil");
  }

  const [
    profile,
    points,
    badges,
    stats,
    activity,
    levels,
    xpBadges,
    cardStats,
    friends,
    reports,
    rewardMilestones,
  ] = await Promise.all([
    getProfile(user.id),
    getUserPoints(user.id),
    getBadges(user.id),
    getProfileStats(user.id),
    getRecentActivity(user.id),
    getLevels(),
    getXpBadgeThresholds(),
    getMyStats(),
    listFriends(),
    listMyReports(),
    getRewardMilestones(),
  ]);

  /*
    Seviye Yolu düğümleri: mevcut seviye + sonraki beş seviye.
    Tamamı levels ve badges verisinden; yeni tablo yok.
  */
  const nodes: LevelNode[] = levels
    .filter(
      (row) =>
        row.level >= points.level && row.level <= points.level + 5,
    )
    .map((row, index, all) => {
      const next = all[index + 1];
      return {
        level: row.level,
        minXp: row.min_xp,
        // Rozet, bu seviye ile bir sonraki seviye arasına düşen XP
        // eşiğine sahipse bu düğümde gösteriliyor.
        badges: xpBadges
          .filter(
            (badge) =>
              badge.amount >= row.min_xp &&
              (next === undefined || badge.amount < next.min_xp),
          )
          .map((badge) => ({
            slug: badge.slug,
            name: badge.name,
            icon: badge.icon,
          })),
        // Ödül kilometre taşları doğrudan min_level ile eşleşiyor.
        rewards: rewardMilestones
          .filter((reward) => reward.minLevel === row.level)
          .map((reward) => ({ title: reward.title })),
      };
    });

  const earnedCount = badges.filter((badge) => badge.earned).length;
  const location = [profile.neighborhood, profile.district, profile.province]
    .filter(Boolean)
    .join(", ");

  // Kategori dağılımı yatay bar için en yüksek değere göre oranlanıyor.
  const maxCategory = Math.max(
    1,
    ...stats.byCategory.map((item) => item.count),
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHud title="Profil" />

      <main className="flex-1 px-4 py-4 has-bottom-nav">
        {/*
          Kutlama ana sayfa DIŞINDA da tetikleniyor: kullanıcı görevi
          tamamlayıp doğrudan profile gidiyorsa seviye atlamasını orada
          da görmeli. İki ekran da aynı localStorage anahtarını
          kullandığı için kutlama yalnız BİR kez çıkıyor.
        */}
        <Arrival
          xp={points.xp}
          coin={points.coin}
          level={points.level}
          badges={badges.filter((b) => b.earned).length}
          unlocked={[]}
        />

        {/*
          GENÇLİG Kimlik Kartı profilin merkezinde ve ortalı. İstatlar
          hesaplanamadıysa (yeni hesap, hiç davranış yok) kart
          gösterilmiyor; boş bir kart "bozuk" gibi duruyordu.
        */}
        {cardStats ? (
          <section className="mb-5 flex justify-center">
            <FlipCard
              identity={{
                username: profile.username ?? "kullanici",
                avatarUrl: profile.avatarUrl,
                level: points.level,
                // Kartta yalnızca ilçe: il adı bayrakla zaten örtülü ve
                // iki satır dar sütunda taşıyordu.
                district: profile.district,
              }}
              stats={cardStats}
              badges={badges
                .filter((badge) => badge.earned)
                .map((badge) => ({
                  id: badge.id,
                  name: badge.name,
                  icon: badge.icon,
                }))}
              totals={{
                tasks: stats.approvedTasks,
                reports: reports.length,
                friends: friends.length,
              }}
            />
          </section>
        ) : null}

        <section className="anim-stagger rounded-2xl border border-edge bg-card p-4" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="flex items-center gap-4">
            <LevelRing
              level={points.level}
              progress={points.progress}
              size={92}
              tone="dark"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                {profile.avatarUrl ? (
                  <Image
                    src={profile.avatarUrl}
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span
                    aria-hidden
                    className="brand-gradient flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  >
                    {(profile.displayName ?? profile.username ?? "?")
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                )}

                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-ink">
                    {profile.displayName ?? profile.username}
                  </p>
                  {profile.username ? (
                    <p className="truncate text-xs text-ink-muted">
                      @{profile.username}
                    </p>
                  ) : null}
                </div>
              </div>

              {location ? (
                <p className="mt-2 flex items-center gap-1 truncate text-xs text-ink-muted">
                  <Icon name="map-pin" className="h-3.5 w-3.5 shrink-0" />
                  {location}
                </p>
              ) : null}

              <p className="mt-1.5 text-xs text-ink-muted">
                {points.nextLevelXp !== null
                  ? `${formatPoints(points.xp)} / ${formatPoints(points.nextLevelXp)} XP`
                  : "En üst seviye"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatTile
              icon="zap"
              value={formatPoints(points.xp)}
              label="XP"
              tone="text-xp"
            />
            <StatTile
              icon="coins"
              value={formatPoints(points.coin)}
              label="Token"
              tone="text-coin"
            />
            <StatTile
              icon="list-checks"
              value={String(stats.approvedTasks)}
              label="Görev"
              tone="text-primary"
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <ProfileLink href="/arkadaslar" icon="users" label="Arkadaşlar" />
            <ProfileLink href="/takim" icon="shield" label="Takımım" />
            <ProfileLink href="/oduller" icon="gift" label="Ödüller" />
            <ProfileLink href="/bildir/gecmis" icon="megaphone" label="Bildirimlerim" />
            <ProfileLink href="/destek" icon="hand-heart" label="Destek" />
            <ProfileLink href="/ayarlar" icon="settings" label="Ayarlar" />
          </div>
        </section>

        <LevelPath
          currentLevel={points.level}
          currentXp={points.xp}
          nodes={nodes}
        />

        <section className="anim-stagger mt-4 rounded-2xl border border-edge bg-card p-4" style={{ "--i": 2 } as React.CSSProperties}>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Icon name="award" className="h-4 w-4 text-primary" />
            Rozetlerim ({earnedCount}/{badges.length})
          </h2>

          <BadgeGrid
            badges={badges.map((badge) => ({
              id: badge.id,
              slug: badge.slug,
              name: badge.name,
              description: badge.description,
              icon: badge.icon,
              earned: badge.earned,
              earned_at: badge.earned_at,
              criteriaText: criteriaText(badge.criteria),
              progress: badge.progress,
              xp_bonus: badge.xp_bonus,
              coin_bonus: badge.coin_bonus,
            }))}
          />
        </section>

        <section className="anim-stagger mt-4 rounded-2xl border border-edge bg-card p-4" style={{ "--i": 2 } as React.CSSProperties}>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Icon name="trending-up" className="h-4 w-4 text-primary" />
            İstatistiklerim
          </h2>

          <p className="mt-2 text-sm text-ink-muted">
            {stats.approvedTasks} tamamlanan görev
            {stats.pendingTasks > 0 ? ` · ${stats.pendingTasks} incelemede` : null}
          </p>

          {stats.byCategory.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {stats.byCategory.map((item) => (
                <li key={item.name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-muted">{item.name}</span>
                    <span className="font-semibold text-ink">{item.count}</span>
                  </div>
                  <div className="xp-track mt-1 h-1.5 w-full">
                    <div
                      className="xp-fill"
                      style={{
                        width: `${Math.round((item.count / maxCategory) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">
              Henüz tamamlanan görev yok.
            </p>
          )}
        </section>

        <section className="anim-stagger mt-4 rounded-2xl border border-edge bg-card p-4" style={{ "--i": 2 } as React.CSSProperties}>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Icon name="activity" className="h-4 w-4 text-primary" />
            Son aktiviteler
          </h2>

          {activity.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">Henüz hareket yok.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {activity.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-ink">
                      {ACTIVITY_LABEL[item.reason] ?? item.reason}
                    </span>
                    <span className="block text-[11px] text-ink-muted">
                      {relativeTime(item.created_at)}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-xp">
                    +{item.amount} XP
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <UserBottomNav active="profile" />
    </div>
  );
}

function StatTile({
  icon,
  value,
  label,
  tone,
}: {
  icon: string;
  value: string;
  label: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl bg-surface px-2 py-2.5 text-center">
      <span className={`mx-auto flex h-6 w-6 items-center justify-center ${tone}`}>
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <p className={`mt-1 text-base font-bold ${tone}`}>{value}</p>
      <p className="text-[11px] text-ink-muted">{label}</p>
    </div>
  );
}

function ProfileLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    /*
      ÖNCEKİ DURUM: gri ikon + gri metin, ince kenar. Altı kutucuk
      da pasif görünüyordu ve tıklanabilir oldukları ancak imleç
      üstüne gelince anlaşılıyordu.

      Şimdi ikon gradyan chip'te ve metin tam kontrastta; dokunma
      alanı 40px'in üstünde.
    */
    <Link
      href={href}
      className="press-soft flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-xl border border-edge bg-card px-2 py-2.5 text-center hover:border-primary/60"
    >
      <span className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg text-white">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <span className="text-[11px] font-semibold text-ink">{label}</span>
    </Link>
  );
}

