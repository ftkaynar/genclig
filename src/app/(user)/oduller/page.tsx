import Link from "next/link";
import { redirect } from "next/navigation";

import { RewardTile, type Eligibility } from "@/components/rewards/reward-tile";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHud } from "@/components/user-hud";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/pills";
import { formatPoints, getUserPoints } from "@/lib/points/queries";
import { getBadgeNames, getMyBadgeIds, listRewards } from "@/lib/rewards/queries";
import { getViewerUser } from "@/lib/auth/viewer";

export const metadata = {
  title: "Ödül Havuzu — GençLİG",
};

export default async function RewardsPage() {
  const user = await getViewerUser();

  if (!user) {
    redirect("/giris?next=/oduller");
  }

  const [rewards, points, myBadges, badgeNames] = await Promise.all([
    listRewards(),
    getUserPoints(user.id),
    getMyBadgeIds(),
    getBadgeNames(),
  ]);

  /*
    Vitrin seçimi: kullanıcının şartlarını karşıladığı ödüller arasından en
    pahalısı. "Alabileceğin en iyi ödül" mantığı — erişilemeyen bir ödülü
    vitrine koymak kullanıcıyı motive etmek yerine engeli hatırlatıyordu.
    Hiçbiri karşılanmıyorsa vitrin en ucuz ödülü gösteriyor: bir sonraki
    hedefi işaret ediyor.
  */
  /*
    Uygun ödül sayısı üst şeritte gösteriliyor: kullanıcı ızgaraya
    bakmadan önce "kaç tanesini alabilirim" sorusuna cevap alsın.
    Öne çıkan tek kart kaldırıldı (aşağıdaki nota bakın); bu sayaç
    onun yerini tutuyor ve hiçbir ödülü kayırmıyor.
  */
  const readyCount = rewards.filter(
    (reward) =>
      points.level >= reward.min_level &&
      (!reward.required_badge_id || myBadges.has(reward.required_badge_id)) &&
      points.coin >= reward.coin_cost,
  ).length;

  /*
    Uygunluk SUNUCUDA hesaplanıyor ve kutucuğa hazır geliyor.

    Kutucuk kendi hesaplasaydı bakiye/seviye/rozet üçlüsünü her karta
    ayrı ayrı geçirmek gerekiyordu ve "eksik ne" mantığı iki yerde
    (ızgara kutucuğu + detay sayfası) ayrı ayrı yazılırdı. Gerçek
    kontrol her hâlükârda sunucuda: redeem_reward şartlara yeniden
    bakıyor.
  */
  const eligibilityOf = (reward: (typeof rewards)[number]): Eligibility => ({
    affordable: points.coin >= reward.coin_cost,
    missingCoin: Math.max(0, reward.coin_cost - points.coin),
    levelOk: points.level >= reward.min_level,
    missingLevel: Math.max(0, reward.min_level - points.level),
    badgeOk: reward.required_badge_id
      ? myBadges.has(reward.required_badge_id)
      : true,
    requiredBadgeName: reward.required_badge_id
      ? (badgeNames.get(reward.required_badge_id) ?? null)
      : null,
  });

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHud title="Ödül Havuzu" />

      {/*
        Bakiye barı yapışkan: mağazada gezerken "param yetiyor mu" sorusu
        her kartta soruluyor, yukarı kaydırmak zorunda kalmamalı.
        HUD'un hemen altında duruyor (top-[57px] HUD yüksekliği).
      */}
      <div className="sticky top-[57px] z-10 border-b border-edge bg-surface/95 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center justify-between rounded-xl bg-card px-3.5 py-2">
          <span className="text-xs text-ink-muted">
            Bakiyen
            {readyCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-status-success/15 px-1.5 py-0.5 text-[10px] font-bold text-status-success">
                {readyCount} ödül hazır
              </span>
            ) : null}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-coin/15 px-3 py-1 text-sm font-bold text-coin">
            <Icon name="coins" className="h-4 w-4" />
            {formatPoints(points.coin)} Token
          </span>
        </div>
      </div>

      <main className="flex-1 px-4 py-4 has-bottom-nav">
        {rewards.length === 0 ? (
          <EmptyState
            icon="gift"
            title="Şu an ödül yok"
            description="Belediyen ödül eklediğinde burada listelenecek."
          />
        ) : (
          /*
            ÖNCEKİ DURUM: tek sütun uzun satır kartları + ayrı bir
            "öne çıkan" afiş. Kullanıcı listeyi tarayıp "hangisini
            ALABILIRIM" sorusuna bakışta cevap veremiyordu.

            Şimdi tek bir ızgara: mobilde iki, geniş ekranda üç-dört
            sütun. Öne çıkan kart kaldırıldı — ızgarada zaten uygun
            olanlar parlıyor ve asıl ayrım "pahalı" değil
            "alabilir miyim".
          */
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {rewards.map((reward, i) => (
              <RewardTile
                key={reward.id}
                reward={reward}
                el={eligibilityOf(reward)}
                index={i}
              />
            ))}
          </ul>
        )}

        <Link
          href="/oduller/kuponlarim"
          className="mt-4 block rounded-full border border-edge px-4 py-2.5 text-center text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          Kuponlarım
        </Link>
      </main>

      <UserBottomNav active="profile" />
    </div>
  );
}
