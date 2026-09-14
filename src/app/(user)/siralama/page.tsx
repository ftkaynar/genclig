import Link from "next/link";
import { redirect } from "next/navigation";

import { Podium } from "@/components/leaderboard/podium";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/pills";
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
import { getTeamLeaderboard } from "@/lib/teams/queries";

export const metadata = {
  title: "Sıralama — GençLİG",
};

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

  /*
    Takım kapsamı ayrı dal: leaderboard_teams farklı bir satır şekli
    döndürüyor ve "benim sıram" bandı kişisel XP'ye dayandığı için takım
    listesinde anlamsız. Aynı bileşene zorlamak yerine iki liste ayrı
    render ediliyor.
  */
  const isTeams = scope === "takimlar";

  const teamRows = isTeams ? await getTeamLeaderboard(period) : [];

  const [rows, myRank, { data: profile }] = isTeams
    ? [[], null, { data: null }]
    : await Promise.all([
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
                    ? "block rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white"
                    : "block rounded-full border border-edge bg-card px-3.5 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
                }
              >
                {item.label}
              </Link>
            </li>
          ))}
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
        {isTeams ? (
          teamRows.length === 0 ? (
            <EmptyState
              icon="users"
              title="Bu dönemde takım puanı yok"
              description="Bir takım kur ya da kodla katıl, takım görevlerinde puan toplayın."
              action={
                <Link
                  href="/takim"
                  className="inline-block rounded-full bg-cta px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Takımıma git
                </Link>
              }
            />
          ) : (
            <ol className="flex flex-col gap-2">
              {teamRows.map((row) => (
                <li
                  key={row.team_id}
                  className="flex items-center gap-3 rounded-2xl border border-edge bg-card p-3"
                >
                  <span className="w-8 shrink-0 text-center text-sm font-bold text-ink-muted">
                    {row.rank}
                  </span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-magenta/15 text-magenta">
                    <Icon name={row.icon} className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {row.team_name}
                    </span>
                    <span className="block text-[11px] text-ink-muted">
                      {row.member_count} üye
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-xp/15 px-2.5 py-1 text-xs font-semibold text-xp">
                    {formatPoints(row.total_xp)}
                  </span>
                </li>
              ))}
            </ol>
          )
        ) : null}

        {!isTeams && !missingLocation && rows.length > 0 ? (
          <div className="mb-3">
            <Podium rows={rows} currentUserId={user.id} />
          </div>
        ) : null}

        {isTeams ? null : missingLocation ? (
          <EmptyState
            icon="map-pin"
            title="Konumun eksik"
            description="Bu sıralamayı görmek için il, ilçe ve mahalleni ayarlaman gerekiyor."
            action={
              <Link
                href="/ayarlar"
                className="inline-block rounded-full bg-cta px-5 py-2.5 text-sm font-semibold text-white"
              >
                Konumunu ayarla
              </Link>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="trophy"
            title="Bu dönemde henüz puan yok"
            description="İlk görevini tamamla, sıralamada yerini al."
          />
        ) : (
          <ol className="flex flex-col gap-2">
            {rows.filter((row) => row.rank > 3).map((row) => (
              <li
                key={row.user_id}
                className={
                  row.user_id === user.id
                    ? "flex items-center gap-3 rounded-2xl border border-primary/50 bg-card p-3"
                    : "flex items-center gap-3 rounded-2xl border border-edge bg-card p-3"
                }
              >
                <span className="w-8 shrink-0 text-center text-sm font-bold text-ink-muted">
                  {row.rank}
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

      {/*
        Kendi sıram yapışkan: kullanıcı listeyi kaydırırken kendi konumunu
        kaybetmemeli. Alt gezinmenin hemen üstünde duruyor.
      */}
      {myRank ? (
        <div className="sticky bottom-[57px] border-t border-edge bg-card px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {myRank.rank}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-ink">
                Benim sıram · {myRank.scope_size} kişi arasında
              </span>
              <span className="block truncate text-[11px] text-ink-muted">
                {formatPoints(myRank.total_xp)} XP
                {aboveMe
                  ? ` · üstündeki ${aboveMe.username} ile fark ${formatPoints(
                      aboveMe.total_xp - myRank.total_xp,
                    )} XP`
                  : myRank.rank === 1
                    ? " · zirvedesin"
                    : null}
              </span>
            </span>
            <Icon name="trending-up" className="h-4 w-4 shrink-0 text-primary" />
          </div>
        </div>
      ) : null}

      <UserBottomNav active="ranking" />
    </div>
  );
}
