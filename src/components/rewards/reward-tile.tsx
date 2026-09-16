import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import type { RewardRow } from "@/lib/rewards/queries";

/*
  Ödül kutucuğu v4 (D31 FAZ O2).

  ÖNCEKİ SORUN: uygunluk tek satırlık bir metinle anlatılıyordu ("2
  seviye kaldı") ve kullanıcı HANGİ şartın eksik olduğunu ancak okuyarak
  öğreniyordu. Üstelik "alabilirim" ile "alamam" arasındaki görsel fark
  yalnızca kenar rengiydi.

  v4'te fark iki katmanlı:
    ALINABİLİR  altın parlama kenarı + köşe rozeti + shine sweep
    ALINAMAZ    desatüre + buzlu kilit katmanı

  ve şartlar YAN YANA mini rozet olarak duruyor: her şart kendi ikonuyla,
  karşılanan ✓ yeşil, karşılanmayan ✗ kırmızı. Kullanıcı okumadan,
  bakışta hangi şartın eksik olduğunu görüyor.
*/

export type Eligibility = {
  affordable: boolean;
  missingCoin: number;
  levelOk: boolean;
  missingLevel: number;
  badgeOk: boolean;
  requiredBadgeName: string | null;
  /** Ödülün gerektirdiği en düşük seviye; rozette gösteriliyor. */
  minLevel: number;
  cost: number;
};

export function eligible(el: Eligibility): boolean {
  return el.affordable && el.levelOk && el.badgeOk;
}

/** Tek satırlık engel özeti; en yakın engel önce. */
export function shortBlocker(el: Eligibility): string | null {
  if (!el.levelOk) return `${el.missingLevel} seviye kaldı`;
  if (!el.badgeOk) return `${el.requiredBadgeName ?? "Rozet"} gerekli`;
  if (!el.affordable) return `${el.missingCoin} Token eksik`;
  return null;
}

const TIER_GRADIENT = [
  { max: 299, from: "from-amber", to: "to-magenta" },
  { max: 700, from: "from-indigo", to: "to-cyan" },
  { max: Infinity, from: "from-coin", to: "to-magenta" },
];

function gradientFor(cost: number) {
  return TIER_GRADIENT.find((t) => cost <= t.max) ?? TIER_GRADIENT[2];
}

/*
  Tek şart rozeti.

  İkon + kısa değer + ✓/✗. Üçü birlikte: renk tek başına ayırt edici
  değil (renk körlüğü) ve ✓/✗ işareti bilgiyi renkten bağımsız taşıyor.
*/
function ConditionChip({
  met,
  icon,
  label,
}: {
  met: boolean;
  icon: string;
  label: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
        met
          ? "bg-status-success/20 text-status-success"
          : "bg-status-danger/25 text-status-danger"
      }`}
    >
      <Icon name={icon} className="h-2.5 w-2.5" />
      {label}
      <Icon name={met ? "check" : "x"} className="h-2.5 w-2.5" />
    </span>
  );
}

/** Kartta gösterilecek şart rozetleri. */
export function conditionChips(el: Eligibility) {
  const chips = [
    { met: el.affordable, icon: "coins", label: String(el.cost) },
  ];
  if (el.minLevel > 1) {
    chips.push({ met: el.levelOk, icon: "star", label: `Sv.${el.minLevel}` });
  }
  if (el.requiredBadgeName) {
    chips.push({ met: el.badgeOk, icon: "award", label: "Rozet" });
  }
  return chips;
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
  const chips = conditionChips(el);

  return (
    <li
      className="tile-stagger"
      style={{ "--i": index } as React.CSSProperties}
    >
      <Link
        href={`/oduller/${reward.id}`}
        className={`tile-press group relative flex h-full flex-col overflow-hidden rounded-2xl border-2 bg-card ${
          ok ? "reward-ready border-coin" : "border-edge"
        }`}
      >
        {/* ---------------------------------------------------- görsel */}
        <span
          className={`relative flex h-[92px] items-center justify-center overflow-hidden ${
            ok ? "" : "saturate-[.35]"
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
              className={`flex h-full w-full items-center justify-center bg-gradient-to-br text-white ${g.from} ${g.to}`}
            >
              <Icon name="gift" className="h-9 w-9" />
            </span>
          )}

          {/* Kıtlık sinyali kullanıcıyı harekete geçiriyor. */}
          {reward.stock !== null && reward.stock <= 5 ? (
            <span className="absolute left-1.5 top-1.5 rounded-full bg-status-danger px-1.5 py-0.5 text-[9px] font-bold text-white">
              Son {reward.stock}
            </span>
          ) : null}

          {ok ? (
            <>
              {/* Işık süpürmesi: yalnız alınabilir kartta. */}
              <span aria-hidden className="reward-shine absolute inset-0" />
              <span className="absolute right-0 top-0 rounded-bl-lg bg-coin px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#3a2a00]">
                Alabilirsin
              </span>
            </>
          ) : (
            /*
              Buzlu kilit katmanı: kart "kapalı" olduğunu yalnız renkle
              değil dokuyla da söylüyor.
            */
            <span
              aria-hidden
              className="absolute inset-0 flex items-center justify-center bg-brand/45 backdrop-blur-[2px]"
            >
              <Icon name="lock" className="h-6 w-6 text-white/85" />
            </span>
          )}
        </span>

        {/* ---------------------------------------------------- içerik */}
        <span className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
          {/* Şartlar YAN YANA: hangi şartın eksik olduğu bakışta belli. */}
          <span className="flex flex-wrap items-center gap-1">
            {chips.map((chip) => (
              <ConditionChip key={chip.icon} {...chip} />
            ))}
          </span>

          <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink">
            {reward.title}
          </span>

          <span className="mt-auto block">
            {ok ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-coin px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#3a2a00]">
                <Icon name="gift" className="h-3 w-3" />
                Hemen al
              </span>
            ) : (
              <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-status-danger/15 px-2 py-0.5 text-[10px] font-bold text-status-danger">
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
