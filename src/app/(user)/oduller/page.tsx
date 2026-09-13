import Link from "next/link";
import { redirect } from "next/navigation";

import { RewardCard } from "@/components/rewards/reward-card";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHeader } from "@/components/user-header";
import { formatPoints, getUserPoints } from "@/lib/points/queries";
import { getBadgeNames, getMyBadgeIds, listRewards } from "@/lib/rewards/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Ödül Havuzu — GençLİG",
};

export default async function RewardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/giris?next=/oduller");
  }

  const [rewards, points, myBadges, badgeNames] = await Promise.all([
    listRewards(),
    getUserPoints(user.id),
    getMyBadgeIds(),
    getBadgeNames(),
  ]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHeader title="Ödül Havuzu" signedIn />

      <div className="px-4 pt-3">
        <div className="flex items-center justify-between rounded-2xl border border-edge bg-card px-4 py-3">
          <span className="text-sm text-ink-muted">Bakiyen</span>
          <span className="rounded-full bg-coin/15 px-3 py-1 text-sm font-bold text-coin">
            {formatPoints(points.coin)} Coin
          </span>
        </div>
      </div>

      <main className="flex-1 px-4 py-4">
        {rewards.length === 0 ? (
          <p className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-ink-muted">
            Şu an ödül yok.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rewards.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                coinBalance={points.coin}
                level={points.level}
                hasBadge={
                  reward.required_badge_id
                    ? myBadges.has(reward.required_badge_id)
                    : true
                }
                requiredBadgeName={
                  reward.required_badge_id
                    ? (badgeNames.get(reward.required_badge_id) ?? null)
                    : null
                }
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
