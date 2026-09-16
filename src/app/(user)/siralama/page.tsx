import { RewardFab } from "@/components/rewards/reward-fab";
import { redirect } from "next/navigation";

import { Podium, type PodiumEntry } from "@/components/leaderboard/podium";
import { RewardStrip } from "@/components/leaderboard/reward-strip";
import {
  getRewardSettings,
  settleLeaderboardRewards,
} from "@/lib/leaderboard/rewards";
import { ScopeTabs } from "@/components/leaderboard/scope-tabs";
import {
  SEASON_STRIPE,
  getActiveSeason,
  seasonAccent,
} from "@/lib/seasons/queries";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/pills";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHud } from "@/components/user-hud";
import {
  PERIODS,
  SCOPES,
  getLeaderboard,
  getMyRank,
  type LeaderboardRow,
  type MyRank,
} from "@/lib/leaderboard/queries";
import { formatPoints } from "@/lib/points/queries";
import { getTeamLeaderboard } from "@/lib/teams/queries";
import { getViewerProfile, getViewerUser } from "@/lib/auth/viewer";

export const metadata = {
  title: "Sıralama — GençLİG",
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ kapsam?: string; donem?: string; mod?: string }>;
}) {
  const user = await getViewerUser();

  if (!user) {
    redirect("/giris?next=/siralama");
  }

  const { kapsam, donem, mod } = await searchParams;

  /*
    MOD ile KAPSAM artık iki ayrı eksen (D34 FAZ ST).

    ÖNCEKİ DURUM: tek `kapsam` parametresi hem modu hem alanı
    taşıyordu ("takimlar" değeri = takım modu). Bu yüzden takım
    sekmesinde coğrafi kapsam seçilemiyordu — iki bilgi tek slota
    sığmıyordu ve Takım sekmesi Bireysel'den daha sığ kalıyordu.

    Eski bağlantılar çalışmaya devam ediyor: `?kapsam=takimlar`
    takım moduna + Türkiye kapsamına çevriliyor. Paylaşılmış ya da
    yer imine eklenmiş bir URL'i kırmak, temiz bir parametre şeması
    uğruna ödenecek bir bedel değil.
  */
  const legacyTeams = kapsam === "takimlar";
  const isTeams = legacyTeams || mod === "takim";

  const scope =
    !legacyTeams && SCOPES.some((item) => item.key === kapsam)
      ? (kapsam as string)
      : "turkiye";

  const period = PERIODS.some((item) => item.key === donem)
    ? (donem as string)
    : "week";

  /*
    Biten dönemin ödülleri burada dağıtılıyor (tembel yol).

    pg_cron bulutta kurulu ve günlük iş zamanlandı; bu çağrı EMNİYET
    AĞI — sessizce düşen bir cron'u fark etmek zor, kullanıcı ziyareti
    ise her gün gerçekleşiyor. Fonksiyon idempotent, iki yol aynı anda
    çalışsa da ikinci yazım UNIQUE kısıtına takılıyor.
  */
  await settleLeaderboardRewards();

  const [teamRows, rewardSettings, season] = await Promise.all([
    // Takım listesi artık kapsam da alıyor (M33).
    isTeams ? getTeamLeaderboard(period, scope) : Promise.resolve([]),
    getRewardSettings(scope, period),
    /*
      Sezon ibaresi başlıkta: "Bu Hafta" bir dönem, sezon ise onu
      kapsayan çerçeve. İkisini birlikte görmek, haftanın hangi sezona
      ait olduğunu söylüyor.
    */
    getActiveSeason(),
  ]);

  /*
    Profil HER İKİ modda da okunuyor (D34 FAZ ST).

    Önceden takım modunda null bırakılıyordu; artık takım sıralaması
    da coğrafi kapsam aldığı için "konumun eksik" uyarısı orada da
    gerekiyor. İstek başına önbellekli, ekstra sorgu açmıyor.
  */
  const profile = await getViewerProfile();

  const [rows, myRank] = isTeams
    ? [[] as LeaderboardRow[], null as MyRank]
    : await Promise.all([
        getLeaderboard(scope, period),
        getMyRank(scope, period),
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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHud title="Sıralama" />

      {season ? (
        <p className="px-4 pt-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider ${SEASON_STRIPE[seasonAccent(season.theme)]}`}
          >
            <Icon name="trophy" className="h-3 w-3" />
            {season.name}
          </span>
        </p>
      ) : null}

      <ScopeTabs scope={scope} period={period} isTeams={isTeams} />

      {/*
        pb-8: "benim sıram" kartı akıştaki yerinden ~28px yukarı kayıyor;
        bu pay olmadan listenin son satırı kartın altında kalıyordu.
      */}
      <main className="flex-1 px-4 pb-8 pt-4 has-bottom-nav">
        <RewardStrip settings={rewardSettings} period={period} />

        {/*
          Konum uyarısı MOD FARK ETMEKSİZİN önce (D34 FAZ ST).

          Takım modunda İl kapsamı seçili ve kullanıcının ili yoksa
          liste zaten boş dönüyordu ama ekran "bir takım kur ya da
          kodla katıl" diyordu — yanlış tavsiye. Sebep konum eksikliği,
          takımsızlık değil.
        */}
        {missingLocation ? (
          <EmptyState
            icon="map-pin"
            title="Konumun eksik"
            description="Bu sıralamayı görmek için il, ilçe ve mahalleni ayarlaman gerekiyor."
            action={
              <ButtonLink href="/ayarlar" variant="primary" icon="map-pin">
                Konumunu ayarla
              </ButtonLink>
            }
          />
        ) : null}

        {isTeams && !missingLocation ? (
          teamRows.length === 0 ? (
            <EmptyState
              icon="users"
              title="Bu kategoride henüz sıralama yok"
              description="Bir takım kur ya da kodla katıl, takım görevlerinde puan toplayın."
              action={
                <ButtonLink href="/takim" variant="primary" icon="shield">
                  Takımıma git
                </ButtonLink>
              }
            />
          ) : (
            <>
              {/* Takım sıralamasında da aynı podyum düzeni. */}
              <div className="mb-3">
                <Podium
                  entries={teamRows
                    .filter((row) => row.rank <= 3)
                    .map<PodiumEntry>((row) => ({
                      rank: row.rank,
                      id: row.team_id,
                      name: row.team_name,
                      subtitle: `${row.member_count} üye`,
                      totalXp: row.total_xp,
                      icon: row.icon,
                    }))}
                  currentId=""
                />
              </div>

            <ol className="flex flex-col gap-2">
              {teamRows.filter((row) => row.rank > 3).map((row) => (
                <li
                  key={row.team_id}
                  className="press-soft flex items-center gap-3 rounded-2xl border border-edge bg-card p-3"
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
            </>
          )
        ) : null}

        {!isTeams && !missingLocation && rows.length > 0 ? (
          <div className="mb-3">
            <Podium
              entries={rows
                .filter((row) => row.rank <= 3)
                .map<PodiumEntry>((row) => ({
                  rank: row.rank,
                  id: row.user_id,
                  name: row.username,
                  subtitle: `Seviye ${row.level}`,
                  totalXp: row.total_xp,
                }))}
              currentId={user.id}
            />
          </div>
        ) : null}

        {!isTeams && !missingLocation && rows.length === 0 ? (
          <EmptyState
            icon="trophy"
            title="Bu kategoride henüz sıralama yok"
            description="İlk görevini tamamla, sıralamada yerini al."
          />
        ) : (
          <ol className="flex flex-col gap-2">
            {rows.filter((row) => row.rank > 3).map((row) => (
              <li
                key={row.user_id}
                className={
                  row.user_id === user.id
                    ? "press-soft flex items-center gap-3 rounded-2xl border border-primary/50 bg-card p-3"
                    : "press-soft flex items-center gap-3 rounded-2xl border border-edge bg-card p-3"
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
        kaybetmemeli.

        ÖNCEKİ SORUN: bant alt gezinmeye yapışıktı (bottom-[57px], tam
        gezinme yüksekliği). Gezinmenin ortasındaki Görevler sekmesi
        yükseltilmiş bir daire (-mt-6 + ring-4) ve gezinmenin üst
        kenarından 22px yukarı taşıyor; bandın ikinci satırını tam
        ortadan kesiyordu.

        Şimdi 85px yukarıda duruyor (57 gezinme + 22 daire taşması + 6
        nefes payı) ve kenar boşluklu yuvarlak bir kart: daire artık
        bandın altındaki boşluktan yükseliyor, iki çubuk birbirine
        değmiyor.
      */}
      {myRank ? (
        <div className="above-bottom-nav sticky z-20 mx-4 rounded-2xl border border-edge bg-card px-3.5 py-2.5 shadow-lg">
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
      <RewardFab />


      <UserBottomNav active="ranking" />
    </div>
  );
}
