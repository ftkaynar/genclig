"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { redeemRewardAction } from "@/lib/rewards/actions";
import { Icon } from "@/components/ui/icon";
import type { RewardRow } from "@/lib/rewards/queries";

/*
  Maliyet kademesi.

  Ödülü "ne kadar değerli" olduğuna göre gruplandırıyor: kullanıcı listeyi
  tararken fiyat okumadan da hangi ödülün büyük olduğunu görüyor. Kademe
  hem çerçeve rengi hem köşe şeridiyle gösteriliyor — renk tek başına
  ayırt edici değil.
*/
const TIERS = [
  { max: 299, key: "bronze", border: "tier-bronze", chip: "bg-[#b07b4f]", label: "Bronz" },
  { max: 700, key: "silver", border: "tier-silver", chip: "bg-[#9aa6b8]", label: "Gümüş" },
  { max: Infinity, key: "gold", border: "tier-gold", chip: "bg-[#d4a02c]", label: "Altın" },
] as const;

function tierOf(cost: number) {
  return TIERS.find((tier) => cost <= tier.max) ?? TIERS[TIERS.length - 1];
}

/** Görseli olmayan ödüllerde kademeye göre gradyan zemin. */
const TIER_GRADIENT: Record<string, string> = {
  bronze: "from-amber to-magenta",
  silver: "from-indigo to-cyan",
  gold: "from-coin to-magenta",
};

/**
 * Ödül kartı.
 *
 * Karşılanmayan şartlar kartı kilitleyip butonu kapatıyor, ama gerçek
 * kontrol sunucuda: buradaki kilit yalnızca kullanıcıya neyin eksik
 * olduğunu söylemek için. Şartlar `redeem_reward` içinde yeniden bakılıyor.
 */
export function RewardCard({
  reward,
  coinBalance,
  level,
  hasBadge,
  requiredBadgeName,
  featured = false,
}: {
  reward: RewardRow;
  coinBalance: number;
  level: number;
  hasBadge: boolean;
  requiredBadgeName: string | null;
  /** Vitrindeki büyük afiş kart. */
  featured?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);

  const tier = tierOf(reward.coin_cost);

  const missing: { text: string; met: boolean }[] = [];
  if (reward.min_level > 1) {
    missing.push({
      text: `Seviye ${reward.min_level}`,
      met: level >= reward.min_level,
    });
  }
  if (reward.required_badge_id) {
    missing.push({
      text: `${requiredBadgeName ?? "Rozet"} rozeti`,
      met: hasBadge,
    });
  }

  const affordable = coinBalance >= reward.coin_cost;
  const locked = missing.some((item) => !item.met) || !affordable;

  async function handleRedeem() {
    setError(null);
    setPending(true);
    try {
      const result = await redeemRewardAction(reward.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setCode(result.code ?? null);
      setConfirming(false);
      // Kart çevirme anı: kod arka yüzde açılıyor.
      setFlipped(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  // --------------------------------------------------------- kod açılış anı
  if (code) {
    return (
      <li className="flip-scene list-none">
        <div className={`flip-inner ${flipped ? "is-flipped" : ""}`}>
          <div className="flip-face flip-front rounded-2xl border-2 border-edge bg-card p-6 text-center">
            <p className="text-sm font-semibold text-ink">{reward.title}</p>
          </div>

          <div className="flip-face flip-back overflow-hidden rounded-2xl border-2 border-primary bg-card text-center">
            {/* Konfeti: CSS-only, kütüphane yok. */}
            <div className="brand-gradient relative px-4 py-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/85">
                Ödül alındı
              </p>
              <p className="mt-0.5 text-sm font-bold">{reward.title}</p>
            </div>

            <div className="ticket-dash" />

            <div className="p-4">
              <p className="text-[11px] text-ink-muted">Kupon kodun</p>
              <p className="mt-1.5 rounded-xl bg-surface px-3 py-3 font-mono text-xl font-bold tracking-[0.25em] text-primary">
                {code}
              </p>
              <Link
                href="/oduller/kuponlarim"
                className="mt-3 inline-block text-xs font-semibold text-primary hover:underline"
              >
                Kuponlarıma git
              </Link>
            </div>
          </div>
        </div>
      </li>
    );
  }

  const visual = (
    <span
      className={`relative flex items-center justify-center overflow-hidden ${
        featured ? "h-32 w-full" : "h-20 w-20 shrink-0 rounded-xl"
      }`}
    >
      {reward.image_url ? (
        <Image
          src={reward.image_url}
          alt=""
          fill
          className="object-cover"
          unoptimized
        />
      ) : (
        <span
          className={`flex h-full w-full items-center justify-center bg-gradient-to-br text-white ${
            TIER_GRADIENT[tier.key] ?? "from-indigo to-primary"
          }`}
        >
          <Icon name="gift" className={featured ? "h-12 w-12" : "h-8 w-8"} />
        </span>
      )}
    </span>
  );

  const costPill = (
    <span className="inline-flex items-center gap-1 rounded-full bg-coin/20 px-3 py-1 text-sm font-bold text-coin">
      <Icon name="coins" className="h-4 w-4" />
      {reward.coin_cost} Token
    </span>
  );

  const conditionChips =
    missing.length > 0 || !affordable ? (
      <span className="mt-2 flex flex-wrap gap-1.5">
        {missing.map((item) => (
          <span
            key={item.text}
            className={
              item.met
                ? "inline-flex items-center gap-1 rounded-full bg-status-success/15 px-2 py-0.5 text-[10px] font-semibold text-status-success"
                : "inline-flex items-center gap-1 rounded-full bg-status-danger/15 px-2 py-0.5 text-[10px] font-semibold text-status-danger"
            }
          >
            {item.met ? (
              <Icon name="check" className="h-3 w-3" />
            ) : (
              <Icon name="lock" className="h-3 w-3" />
            )}
            {item.text}
          </span>
        ))}
        {!affordable ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-status-danger/15 px-2 py-0.5 text-[10px] font-semibold text-status-danger">
            <Icon name="lock" className="h-3 w-3" />
            {reward.coin_cost - coinBalance} Token daha
          </span>
        ) : null}
      </span>
    ) : null;

  const actions = (
    <>
      {error ? (
        <p role="alert" className="mt-2.5 text-xs text-status-danger">
          {error}
        </p>
      ) : null}

      {confirming ? (
        <div className="mt-3 rounded-xl border border-edge bg-surface p-3">
          <p className="text-xs text-ink">
            {reward.coin_cost} Token harcanacak. Onaylıyor musun?
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={handleRedeem}
              disabled={pending}
              className="btn-chunky bg-cta flex-1 rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Alınıyor..." : "Evet, al"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="flex-1 rounded-full border border-edge px-4 py-2 text-sm font-medium text-ink-muted"
            >
              Vazgeç
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={locked}
          className="btn-chunky bg-cta mt-3 w-full rounded-full px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {locked ? "Şartlar karşılanmadı" : "AL"}
        </button>
      )}
    </>
  );

  // ------------------------------------------------------------- vitrin kartı
  if (featured) {
    return (
      <li
        className={`relative overflow-hidden rounded-3xl border-2 bg-card ${tier.border}`}
      >
        <span className="absolute left-0 top-0 z-10 rounded-br-lg bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
          Öne çıkan
        </span>
        <span
          className={`absolute right-0 top-0 z-10 rounded-bl-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white ${tier.chip}`}
        >
          {tier.label}
        </span>

        <div className="relative">{visual}</div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 text-base font-bold text-ink">
              {reward.title}
            </p>
            {costPill}
          </div>
          <p className="mt-1 text-xs text-ink-muted">{reward.description}</p>
          {reward.stock !== null ? (
            <p className="mt-1.5 text-[11px] font-semibold text-status-warning">
              Sınırlı: {reward.stock} adet
            </p>
          ) : null}
          {conditionChips}
          {actions}
        </div>
      </li>
    );
  }

  // ------------------------------------------------------------- normal kart
  return (
    <li
      className={`relative overflow-hidden rounded-2xl border-2 bg-card p-3.5 ${tier.border} ${
        locked ? "opacity-75" : ""
      }`}
    >
      <span
        className={`absolute right-0 top-0 rounded-bl-lg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white ${tier.chip}`}
      >
        {tier.label}
      </span>

      <div className="flex gap-3">
        {visual}
        <div className="min-w-0 flex-1 pr-12">
          <p className="text-sm font-semibold text-ink">{reward.title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
            {reward.description}
          </p>
          <span className="mt-1.5 block">{costPill}</span>
          {reward.stock !== null ? (
            <p className="mt-1 text-[11px] text-ink-muted">
              Sınırlı: {reward.stock} adet
            </p>
          ) : null}
        </div>
      </div>

      {conditionChips}
      {actions}
    </li>
  );
}
