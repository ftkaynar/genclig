"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { redeemRewardAction } from "@/lib/rewards/actions";

/*
  Ödül alma paneli — detay sayfasının alt bloğu.

  Buradaki kilit yalnızca kullanıcıya neyin eksik olduğunu söylemek için.
  GERÇEK kontrol sunucuda: `redeem_reward` şartları yeniden bakıyor ve
  bakiyeyi orada düşüyor. İstemcide "uygun" görünen bir ödül sunucuda
  reddedilebilir; o durumda hata mesajı gösteriliyor.

  Kupon kodu ÇEVİRME animasyonuyla açılıyor (.flip-scene, D22 FAZ R ile
  aynı teknik): kazanma anı listedeki bir satırda kaybolmasın.
*/
export function RedeemPanel({
  rewardId,
  rewardTitle,
  cost,
  eligible,
}: {
  rewardId: string;
  rewardTitle: string;
  cost: number;
  eligible: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);

  async function handleRedeem() {
    setError(null);
    setPending(true);
    try {
      const result = await redeemRewardAction(rewardId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setCode(result.code ?? null);
      setConfirming(false);
      setFlipped(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (code) {
    return (
      <div className="flip-scene">
        <div className={`flip-inner ${flipped ? "is-flipped" : ""}`}>
          <div className="flip-face flip-front rounded-2xl border-2 border-edge bg-card p-6 text-center">
            <p className="text-sm font-semibold text-ink">{rewardTitle}</p>
          </div>

          <div className="flip-face flip-back overflow-hidden rounded-2xl border-2 border-primary bg-card text-center">
            <div className="brand-gradient px-4 py-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/85">
                Ödül alındı
              </p>
              <p className="mt-0.5 text-sm font-bold">{rewardTitle}</p>
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
      </div>
    );
  }

  return (
    <>
      {error ? (
        <p
          role="alert"
          className="mb-2.5 rounded-xl border border-status-danger/40 bg-status-danger/10 px-3.5 py-2.5 text-xs text-status-danger"
        >
          {error}
        </p>
      ) : null}

      {confirming ? (
        <div className="anim-pop rounded-2xl border border-edge bg-card p-3.5">
          <p className="text-sm text-ink">
            {cost} Token harcanacak. Onaylıyor musun?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleRedeem}
              disabled={pending}
              className="btn-chunky bg-cta flex-1 rounded-full px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Alınıyor..." : "Evet, al"}
            </button>
            <Button variant="secondary" size="md" type="button" onClick={() => setConfirming(false)} disabled={pending}>
              Vazgeç
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!eligible}
          className={`btn-chunky w-full rounded-full px-4 py-3.5 text-base font-bold uppercase tracking-wide text-white transition-all disabled:cursor-not-allowed ${
            eligible
              ? "reward-ready bg-status-success"
              : "bg-edge text-ink-muted"
          }`}
        >
          {eligible ? (
            <span className="inline-flex items-center gap-2">
              <Icon name="gift" className="h-5 w-5" />
              {cost} Token ile al
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Icon name="lock" className="h-5 w-5" />
              Şartlar karşılanmadı
            </span>
          )}
        </button>
      )}
    </>
  );
}
