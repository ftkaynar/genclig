import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RedeemPanel } from "@/components/rewards/redeem-panel";
import { Icon } from "@/components/ui/icon";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHud } from "@/components/user-hud";
import { getViewerUser } from "@/lib/auth/viewer";
import { formatPoints, getUserPoints } from "@/lib/points/queries";
import { getBadgeNames, getMyBadgeIds, listRewards } from "@/lib/rewards/queries";

export const metadata = { title: "Ödül — GençLİG" };

/*
  Ödül detayı.

  Neden ayrı sayfa: ızgara kutucuğu ödülün adını, fiyatını ve tek satırlık
  engelini taşıyor; tam açıklama, şart listesi ve satın alma akışı oraya
  sığmıyordu. Önceki sürümde satın alma listedeki kartın içinde
  gerçekleşiyordu ve kupon kodu ızgaranın ortasında açılıyordu —
  kutlama anı kaybolup gidiyordu.

  Ödül ayrı bir sorguyla değil, listeden süzülerek bulunuyor: listRewards
  zaten belediye/global görünürlüğünü çözüyor ve tek ödül için ikinci bir
  görünürlük kuralı yazmak, kuralın iki yerde ayrışma riski demekti.
*/
export default async function RewardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getViewerUser();
  if (!user) {
    redirect("/giris?next=/oduller");
  }

  const { id } = await params;

  const [rewards, points, myBadges] = await Promise.all([
    listRewards(),
    getUserPoints(user.id),
    getMyBadgeIds(),
  ]);

  const reward = rewards.find((row) => row.id === id);
  if (!reward) {
    notFound();
  }

  // Rozet adları referans önbelleğinden; kullanıcıya göre değişmiyor.
  const badgeNames = reward.required_badge_id
    ? await getBadgeNames()
    : new Map<string, string>();

  const levelOk = points.level >= reward.min_level;
  const badgeOk = reward.required_badge_id
    ? myBadges.has(reward.required_badge_id)
    : true;
  const affordable = points.coin >= reward.coin_cost;
  const ok = levelOk && badgeOk && affordable;

  const conditions = [
    {
      met: affordable,
      label: `${reward.coin_cost} Token`,
      detail: affordable
        ? `Bakiyen ${formatPoints(points.coin)} Token`
        : `${reward.coin_cost - points.coin} Token eksik`,
      icon: "coins",
    },
    ...(reward.min_level > 1
      ? [
          {
            met: levelOk,
            label: `Seviye ${reward.min_level}`,
            detail: levelOk
              ? `Seviye ${points.level}'desin`
              : `${reward.min_level - points.level} seviye kaldı`,
            icon: "star",
          },
        ]
      : []),
    ...(reward.required_badge_id
      ? [
          {
            met: badgeOk,
            label: `${badgeNames.get(reward.required_badge_id) ?? "Rozet"} rozeti`,
            detail: badgeOk ? "Kazandın" : "Henüz kazanılmadı",
            icon: "award",
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHud title="Ödül" />

      <main className="flex-1 px-4 py-4 has-bottom-nav">
        <Link
          href="/oduller"
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <Icon name="chevron-right" className="h-4 w-4 rotate-180" />
          Ödül havuzu
        </Link>

        {/* ---------------------------------------------------- görsel */}
        <div className="anim-stagger relative h-44 overflow-hidden rounded-3xl border border-edge">
          {reward.image_url ? (
            <Image
              src={reward.image_url}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <span className="brand-gradient flex h-full w-full items-center justify-center text-white">
              <Icon name="gift" className="h-16 w-16" />
            </span>
          )}

          {reward.stock !== null ? (
            <span className="absolute left-3 top-3 rounded-full bg-status-danger px-2.5 py-1 text-[11px] font-bold text-white">
              Sınırlı: {reward.stock} adet
            </span>
          ) : null}
        </div>

        <h1
          className="anim-stagger mt-3 text-xl font-bold text-ink"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          {reward.title}
        </h1>

        <p
          className="anim-stagger mt-1 text-sm text-ink-muted"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          {reward.description}
        </p>

        <span
          className="anim-stagger mt-3 inline-flex items-center gap-1.5 rounded-full bg-coin/20 px-3.5 py-1.5 text-base font-bold text-coin"
          style={{ "--i": 3 } as React.CSSProperties}
        >
          <Icon name="coins" className="h-4.5 w-4.5" />
          {reward.coin_cost} Token
        </span>

        {/* --------------------------------------------------- şartlar */}
        <section
          className="anim-stagger mt-4"
          style={{ "--i": 4 } as React.CSSProperties}
        >
          <h2 className="mb-2 text-sm font-semibold text-ink">Şartlar</h2>
          <ul className="divide-y divide-edge overflow-hidden rounded-2xl border border-edge bg-card">
            {conditions.map((c) => (
              <li
                key={c.label}
                className="flex items-center gap-3 px-3.5 py-2.5"
              >
                {/*
                  Karşılanan ✓, eksik ✗ — ikon ve renk BİRLİKTE. Eksik
                  satır ayrıca kalın yazılıyor: kullanıcı listeyi tararken
                  neyin eksik olduğunu renk görmeden de bulmalı.
                */}
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    c.met
                      ? "bg-status-success/15 text-status-success"
                      : "bg-status-danger/15 text-status-danger"
                  }`}
                >
                  <Icon name={c.met ? "check" : "x"} className="h-3.5 w-3.5" />
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[13px] ${
                      c.met ? "font-medium text-ink" : "font-bold text-ink"
                    }`}
                  >
                    {c.label}
                  </span>
                  <span
                    className={`block text-[11px] ${
                      c.met ? "text-ink-muted" : "font-semibold text-status-danger"
                    }`}
                  >
                    {c.detail}
                  </span>
                </span>

                <Icon
                  name={c.icon}
                  className="h-4 w-4 shrink-0 text-ink-muted"
                />
              </li>
            ))}
          </ul>
        </section>

        <div
          className="anim-stagger mt-4"
          style={{ "--i": 5 } as React.CSSProperties}
        >
          <RedeemPanel
            rewardId={reward.id}
            rewardTitle={reward.title}
            cost={reward.coin_cost}
            eligible={ok}
          />
        </div>
      </main>

      <UserBottomNav active="profile" />
    </div>
  );
}
