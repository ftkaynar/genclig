import Link from "next/link";
import { redirect } from "next/navigation";

import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHeader } from "@/components/user-header";
import {
  PERIODS,
  SCOPES,
  getLeaderboard,
  getMyRank,
} from "@/lib/leaderboard/queries";
import { formatPoints } from "@/lib/points/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Sıralama — GençLİG",
};

/** İlk üçün madalya işareti. */
const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ kapsam?: string; donem?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/giris?next=/siralama");
  }

  const { kapsam, donem } = await searchParams;
  const scope = SCOPES.some((item) => item.key === kapsam)
    ? (kapsam as string)
    : "turkiye";
  const period = PERIODS.some((item) => item.key === donem)
    ? (donem as string)
    : "week";

  const [rows, myRank, { data: profile }] = await Promise.all([
    getLeaderboard(scope, period),
    getMyRank(scope, period),
    supabase
      .from("profiles")
      .select("province_id,district_id,neighborhood_id")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  // Kapsam için gereken konum bilgisi eksikse liste boş döner; kullanıcıya
  // sebebini söylemek gerekiyor.
  const missingLocation =
    (scope === "il" && !profile?.province_id) ||
    (scope === "ilce" && !profile?.district_id) ||
    (scope === "mahalle" && !profile?.neighborhood_id);

  const aboveMe =
    myRank && myRank.rank > 1
      ? rows.find((row) => row.rank === myRank.rank - 1)
      : undefined;

  const href = (nextScope: string, nextPeriod: string) =>
    `/siralama?kapsam=${nextScope}&donem=${nextPeriod}`;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHeader title="Sıralama" signedIn />

      <nav aria-label="Kapsam" className="px-4 pt-3">
        <ul className="flex flex-wrap gap-2">
          {SCOPES.map((item) => (
            <li key={item.key}>
              <Link
                href={href(item.key, period)}
                aria-current={item.key === scope ? "page" : undefined}
                className={
                  item.key === scope
                    ? "block rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-brand"
                    : "block rounded-full border border-edge bg-card px-3.5 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
                }
              >
                {item.label}
              </Link>
            </li>
          ))}
          {/* Arkadaşlık domaini sonraki dilimlerde; sekme yerini tutuyor. */}
          <li>
            <span
              aria-disabled
              className="block rounded-full border border-edge bg-card px-3.5 py-1.5 text-xs font-medium text-ink-muted opacity-50"
            >
              Arkadaşlar — yakında
            </span>
          </li>
        </ul>
      </nav>

      <nav aria-label="Dönem" className="px-4 pt-2">
        <ul className="flex gap-2">
          {PERIODS.map((item) => (
            <li key={item.key}>
              <Link
                href={href(scope, item.key)}
                aria-current={item.key === period ? "page" : undefined}
                className={
                  item.key === period
                    ? "block rounded-full bg-xp/20 px-3 py-1 text-[11px] font-semibold text-xp"
                    : "block rounded-full border border-edge px-3 py-1 text-[11px] font-medium text-ink-muted hover:text-ink"
                }
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <main className="flex-1 px-4 py-4">
        {myRank ? (
          <div className="mb-3 rounded-2xl border border-primary/50 bg-card p-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink">Benim sıram</span>
              <span className="text-sm font-bold text-primary">
                {myRank.rank}. / {myRank.scope_size}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              {formatPoints(myRank.total_xp)} XP
              {aboveMe
                ? ` · üstündeki ${aboveMe.username} ile fark ${formatPoints(
                    aboveMe.total_xp - myRank.total_xp,
                  )} XP`
                : myRank.rank === 1
                  ? " · zirvedesin"
                  : null}
            </p>
          </div>
        ) : null}

        {missingLocation ? (
          <div className="rounded-2xl border border-edge bg-card px-4 py-8 text-center">
            <p className="text-sm text-ink-muted">
              Bu sıralamayı görmek için konumunu ayarlaman gerekiyor.
            </p>
            <Link
              href="/ayarlar"
              className="mt-3 inline-block rounded-full bg-cta px-5 py-2.5 text-sm font-semibold text-brand"
            >
              Konumunu ayarla
            </Link>
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-ink-muted">
            Bu dönemde henüz puan toplayan yok.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {rows.map((row) => (
              <li
                key={row.user_id}
                className={
                  row.user_id === user.id
                    ? "flex items-center gap-3 rounded-2xl border border-primary/50 bg-card p-3"
                    : "flex items-center gap-3 rounded-2xl border border-edge bg-card p-3"
                }
              >
                <span className="w-8 shrink-0 text-center text-sm font-bold text-ink-muted">
                  {MEDAL[row.rank] ?? row.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {row.username}
                  </span>
                  <span className="block text-[11px] text-ink-muted">
                    Seviye {row.level}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-xp/15 px-2.5 py-1 text-xs font-semibold text-xp">
                  {formatPoints(row.total_xp)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </main>

      <UserBottomNav active="ranking" />
    </div>
  );
}
