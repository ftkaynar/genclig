import Link from "next/link";
import { redirect } from "next/navigation";

import { RewardCard } from "@/components/rewards/reward-card";
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
  const meetsConditions = (reward: (typeof rewards)[number]) =>
    points.level >= reward.min_level &&
    (!reward.required_badge_id || myBadges.has(reward.required_badge_id)) &&
    points.coin >= reward.coin_cost;

  const affordable = rewards.filter(meetsConditions);

  const featured =
    affordable.length > 0
      ? affordable.reduce((best, item) =>
          item.coin_cost > best.coin_cost ? item : best,
        )
      : rewards.length > 0
        ? rewards.reduce((cheapest, item) =>
            item.coin_cost < cheapest.coin_cost ? item : cheapest,
          )
        : null;

  const rest = rewards.filter((reward) => reward.id !== featured?.id);

  const cardProps = (reward: (typeof rewards)[number]) => ({
    reward,
    coinBalance: points.coin,
    level: points.level,
    hasBadge: reward.required_badge_id
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
          <span className="text-xs text-ink-muted">Bakiyen</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-coin/15 px-3 py-1 text-sm font-bold text-coin">
            <Icon name="coins" className="h-4 w-4" />
            {formatPoints(points.coin)} Token
          </span>
        </div>
      </div>

      <main className="flex-1 px-4 py-4">
        {rewards.length === 0 ? (
          <EmptyState
            icon="gift"
            title="Şu an ödül yok"
            description="Belediyen ödül eklediğinde burada listelenecek."
          />
        ) : (
          <>
            {featured ? (
              <ul className="mb-4 list-none">
                <RewardCard key={featured.id} {...cardProps(featured)} featured />
              </ul>
            ) : null}

            {rest.length > 0 ? (
              <>
                <h2 className="mb-2 text-sm font-semibold text-ink">
                  Tüm ödüller
                </h2>
                <ul className="flex flex-col gap-3">
                  {rest.map((reward) => (
                    <RewardCard key={reward.id} {...cardProps(reward)} />
                  ))}
                </ul>
              </>
            ) : null}
          </>
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
