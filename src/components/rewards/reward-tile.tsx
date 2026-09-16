import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import type { RewardRow } from "@/lib/rewards/queries";

/*
  Ödül kutucuğu v3 — ızgara için.

  ÖNCEKİ SORUN: ödüller tek sütunda uzun satır kartlarıydı ve uygunluk
  ancak kartın altındaki çiplerden okunuyordu. Kullanıcı listeyi tarayıp
  "hangisini ALABILIRIM" sorusuna bakışta cevap veremiyordu.

  v3: iki sütun ızgara ve uygunluk KARTIN KENDİSİNDE. Alabildiği ödül
  parlıyor (yeşil kenar + nabız), alamadığı kilitli ve eksik şartı tek
  satırda yazıyor ("2 seviye kaldı", "350 Token eksik"). Renk TEK BAŞINA
  ayırt edici değil: parlayanda "ALABİLİRSİN" yazısı, kilitlide kilit
  ikonu var.
*/

export type Eligibility = {
  affordable: boolean;
  missingCoin: number;
  levelOk: boolean;
  missingLevel: number;
  badgeOk: boolean;
  requiredBadgeName: string | null;
};

/** Şartların tek satırlık özeti; en yakın engel önce. */
export function shortBlocker(el: Eligibility): string | null {
  if (!el.levelOk) return `${el.missingLevel} seviye kaldı`;
  if (!el.badgeOk) return `${el.requiredBadgeName ?? "Rozet"} gerekli`;
  if (!el.affordable) return `${el.missingCoin} Token eksik`;
  return null;
}

export function eligible(el: Eligibility): boolean {
  return el.affordable && el.levelOk && el.badgeOk;
}

const TIER_GRADIENT = [
  { max: 299, from: "from-amber", to: "to-magenta" },
  { max: 700, from: "from-indigo", to: "to-cyan" },
  { max: Infinity, from: "from-coin", to: "to-magenta" },
];

function gradientFor(cost: number) {
  return TIER_GRADIENT.find((t) => cost <= t.max) ?? TIER_GRADIENT[2];
}

export function RewardTile({
  reward,
  el,
  index = 0,
}: {
  reward: RewardRow;
  el: Eligibility;
  index?: number;
}) {
  const ok = eligible(el);
  const blocker = shortBlocker(el);
  const g = gradientFor(reward.coin_cost);

  return (
    <li
      className="tile-stagger"
      style={{ "--i": index } as React.CSSProperties}
    >
      <Link
        href={`/oduller/${reward.id}`}
        className={`tile-press group relative flex h-full flex-col overflow-hidden rounded-2xl border-2 bg-card ${
          ok
            ? "reward-ready border-status-success"
            : "border-edge opacity-90"
        }`}
      >
        {/* ---------------------------------------------------- görsel */}
        <span className="relative flex h-[92px] items-center justify-center overflow-hidden">
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
              className={`flex h-full w-full items-center justify-center bg-gradient-to-br text-white ${g.from} ${g.to}`}
            >
              <Icon name="gift" className="h-9 w-9" />
            </span>
          )}

          {/* Stok uyarısı: kıtlık sinyali kullanıcıyı harekete geçiriyor. */}
          {reward.stock !== null && reward.stock <= 5 ? (
            <span className="absolute left-1.5 top-1.5 rounded-full bg-status-danger px-1.5 py-0.5 text-[9px] font-bold text-white">
              Son {reward.stock}
            </span>
          ) : null}

          {!ok ? (
            <span
              aria-hidden
              className="absolute inset-0 flex items-center justify-center bg-brand/45"
            >
              <Icon name="lock" className="h-6 w-6 text-white/85" />
            </span>
          ) : null}
        </span>

        {/* ---------------------------------------------------- içerik */}
        <span className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
          <span className="reward-pill inline-flex w-fit items-center gap-0.5 rounded-full bg-coin px-1.5 py-0.5 text-[11px] font-extrabold text-[#3a2a00]">
            <Icon name="coins" className="h-3 w-3" />
            {reward.coin_cost}
          </span>

          <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink">
            {reward.title}
          </span>

          <span className="mt-auto block">
            {ok ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-status-success px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                <Icon name="check" className="h-3 w-3" />
                Alabilirsin
              </span>
            ) : (
              <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                <Icon name="lock" className="h-3 w-3 shrink-0" />
                {blocker}
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}
