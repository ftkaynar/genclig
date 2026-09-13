"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { redeemRewardAction } from "@/lib/rewards/actions";
import type { RewardRow } from "@/lib/rewards/queries";

/**
 * Ödül kartı.
 *
 * Karşılanmayan şartlar kartı soluklaştırıp butonu kapatıyor, ama gerçek
 * kontrol sunucuda: buradaki kilit yalnızca kullanıcıya neyin eksik olduğunu
 * söylemek için. Şartlar sunucuda yeniden bakılıyor.
 */
export function RewardCard({
  reward,
  coinBalance,
  level,
  hasBadge,
  requiredBadgeName,
}: {
  reward: RewardRow;
  coinBalance: number;
  level: number;
  hasBadge: boolean;
  requiredBadgeName: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const missing: string[] = [];
  if (level < reward.min_level) {
    missing.push(`Seviye ${reward.min_level} gerekiyor`);
  }
  if (reward.required_badge_id && !hasBadge) {
    missing.push(`${requiredBadgeName ?? "Rozet"} rozeti gerekiyor`);
  }
  if (coinBalance < reward.coin_cost) {
    missing.push(`${reward.coin_cost - coinBalance} coin daha gerekiyor`);
  }

  const locked = missing.length > 0;

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
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (code) {
    return (
      <li className="rounded-2xl border border-primary/50 bg-card p-4 text-center">
        <p className="text-sm font-semibold text-ink">{reward.title}</p>
        <p className="mt-1 text-xs text-ink-muted">Kupon kodun</p>
        <p className="mt-2 rounded-xl bg-surface px-3 py-2.5 font-mono text-lg font-bold tracking-widest text-primary">
          {code}
        </p>
        <p className="mt-2 text-[11px] text-ink-muted">
          Kodu kuponlarım sayfasından da görebilirsin.
        </p>
      </li>
    );
  }

  return (
    <li
      className={
        locked
          ? "rounded-2xl border border-edge bg-card p-4 opacity-60"
          : "rounded-2xl border border-edge bg-card p-4"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{reward.title}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{reward.description}</p>
        </div>
        <span className="shrink-0 rounded-full bg-coin/15 px-2.5 py-1 text-xs font-semibold text-coin">
          {reward.coin_cost}
        </span>
      </div>

      {reward.stock !== null ? (
        <p className="mt-2 text-[11px] text-ink-muted">
          Sınırlı sayıda ({reward.stock} adet)
        </p>
      ) : null}

      {locked ? (
        <ul className="mt-2.5 flex flex-col gap-1">
          {missing.map((item) => (
            <li key={item} className="text-[11px] text-ink-muted">
              🔒 {item}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2.5 text-xs text-status-danger">
          {error}
        </p>
      ) : null}

      {confirming ? (
        <div className="mt-3 rounded-xl border border-edge bg-surface p-3">
          <p className="text-xs text-ink">
            {reward.coin_cost} coin harcanacak. Onaylıyor musun?
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={handleRedeem}
              disabled={pending}
              className="flex-1 rounded-full bg-cta px-4 py-2 text-sm font-semibold text-brand disabled:opacity-60"
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
          className="mt-3 w-full rounded-full bg-cta px-4 py-2.5 text-sm font-semibold text-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          {locked ? "Şartlar karşılanmadı" : "Kullan"}
        </button>
      )}
    </li>
  );
}
