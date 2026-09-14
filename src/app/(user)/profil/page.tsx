import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Icon } from "@/components/ui/icon";
import { LevelRing } from "@/components/ui/level-ring";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHeader } from "@/components/user-header";
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
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Profil — GençLİG",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/giris?next=/profil");
  }

  const [profile, points, badges, stats, activity] = await Promise.all([
    getProfile(user.id),
    getUserPoints(user.id),
    getBadges(user.id),
    getProfileStats(user.id),
    getRecentActivity(user.id),
  ]);

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
      <UserHeader title="Profil" signedIn />

      <main className="flex-1 px-4 py-4">
        <section className="rounded-2xl border border-edge bg-card p-4">
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
              label="Coin"
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
            <ProfileLink href="/ayarlar" icon="settings" label="Ayarlar" />
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-edge bg-card p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Icon name="award" className="h-4 w-4 text-primary" />
            Rozetlerim ({earnedCount}/{badges.length})
          </h2>

          {badges.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">
              Henüz rozet tanımlanmamış.
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-3 gap-2.5">
              {badges.map((badge) => (
                <li
                  key={badge.id}
                  className={
                    badge.earned
                      ? "rounded-xl border border-primary/50 bg-primary/5 p-2.5 text-center"
                      : "rounded-xl border border-edge bg-surface p-2.5 text-center"
                  }
                >
                  <span
                    className={
                      badge.earned
                        ? "mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"
                        : "mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-edge/50 text-ink-muted"
                    }
                  >
                    <Icon
                      name={badge.earned ? badge.icon : "lock"}
                      className="h-5 w-5"
                    />
                  </span>

                  <p
                    className={
                      badge.earned
                        ? "mt-1.5 text-[11px] font-semibold leading-tight text-ink"
                        : "mt-1.5 text-[11px] font-semibold leading-tight text-ink-muted"
                    }
                  >
                    {badge.name}
                  </p>

                  {!badge.earned ? (
                    <p className="mt-0.5 text-[10px] leading-tight text-ink-muted">
                      {criteriaText(badge.criteria)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-4 rounded-2xl border border-edge bg-card p-4">
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
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-cyan transition-[width] duration-700 ease-out"
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

        <section className="mt-4 rounded-2xl border border-edge bg-card p-4">
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
    <Link
      href={href}
      className="flex flex-col items-center gap-1 rounded-xl border border-edge px-2 py-2.5 text-center transition-colors hover:border-primary/60"
    >
      <Icon name={icon} className="h-4 w-4 text-ink-muted" />
      <span className="text-[11px] font-medium text-ink-muted">{label}</span>
    </Link>
  );
}

