import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHeader title="Profil" signedIn />

      <main className="flex-1 px-4 py-4">
        <section className="rounded-2xl border border-edge bg-card p-4">
          <div className="flex items-center gap-3.5">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 rounded-full object-cover"
                unoptimized
              />
            ) : (
              <span
                aria-hidden
                className="brand-gradient flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white"
              >
                {(profile.displayName ?? profile.username ?? "?")
                  .charAt(0)
                  .toUpperCase()}
              </span>
            )}

            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-ink">
                {profile.displayName ?? profile.username}
              </p>
              {profile.username ? (
                <p className="truncate text-sm text-ink-muted">
                  @{profile.username}
                </p>
              ) : null}
              {location ? (
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  {location}
                </p>
              ) : null}
            </div>
          </div>

          {/* Seviye ilerlemesi */}
          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-ink">
                Seviye {points.level}
              </span>
              <span className="text-xs text-ink-muted">
                {points.nextLevelXp !== null
                  ? `${formatPoints(points.xp)} / ${formatPoints(points.nextLevelXp)} XP`
                  : "En üst seviye"}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.round(points.progress * 100)}%` }}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-surface px-2 py-2.5">
              <p className="text-base font-bold text-xp">
                {formatPoints(points.xp)}
              </p>
              <p className="text-[11px] text-ink-muted">XP</p>
            </div>
            <div className="rounded-xl bg-surface px-2 py-2.5">
              <p className="text-base font-bold text-coin">
                {formatPoints(points.coin)}
              </p>
              <p className="text-[11px] text-ink-muted">Coin</p>
            </div>
            <div className="rounded-xl bg-surface px-2 py-2.5">
              <p className="text-base font-bold text-primary">
                {stats.approvedTasks}
              </p>
              <p className="text-[11px] text-ink-muted">Görev</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              href="/oduller"
              className="rounded-full border border-edge px-4 py-2 text-center text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              Ödüller
            </Link>
            <Link
              href="/bildir/gecmis"
              className="rounded-full border border-edge px-4 py-2 text-center text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              Bildirimlerim
            </Link>
          </div>

          <Link
            href="/ayarlar"
            className="mt-4 block rounded-full border border-edge px-4 py-2 text-center text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Ayarlar
          </Link>
        </section>

        <section className="mt-4 rounded-2xl border border-edge bg-card p-4">
          <h2 className="text-sm font-semibold text-ink">
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
                      ? "rounded-xl border border-primary/50 bg-surface p-2.5 text-center"
                      : "rounded-xl border border-edge bg-surface p-2.5 text-center opacity-50"
                  }
                >
                  <span aria-hidden className="block text-xl">
                    {badge.earned ? "🏅" : "🔒"}
                  </span>
                  <p className="mt-1 text-[11px] font-semibold leading-tight text-ink">
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
          <h2 className="text-sm font-semibold text-ink">İstatistiklerim</h2>
          <p className="mt-2 text-sm text-ink-muted">
            {stats.approvedTasks} tamamlanan görev
            {stats.pendingTasks > 0
              ? ` · ${stats.pendingTasks} incelemede`
              : null}
          </p>

          {stats.byCategory.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5">
              {stats.byCategory.map((item) => (
                <li
                  key={item.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-ink-muted">{item.name}</span>
                  <span className="font-semibold text-ink">{item.count}</span>
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
          <h2 className="text-sm font-semibold text-ink">Son aktiviteler</h2>

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
