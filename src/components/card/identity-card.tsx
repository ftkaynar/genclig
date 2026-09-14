import Image from "next/image";

import { STAT_META, type UserStats } from "@/lib/stats/labels";

/*
  GENÇLİG Kimlik Kartı — VIP.

  TASARIM TAMAMEN ÖZGÜN: hiçbir oyunun, markanın ya da lisanslı ürünün
  kartı taklit edilmiyor; dış görsel, logo ya da ticari font
  kullanılmıyor. Form bilerek yuvarlak köşeli dikdörtgen (kalkan silueti
  değil), tipografi sistem serif'i, yüzeyler saf CSS gradyanı.

  Kademeler aynı iskeleti paylaşıyor, görsel yoğunluk artıyor:
    bronz   → mat bakır çerçeve, efekt yok
    gümüş   → metalik gri-mavi, hafif parıltı
    altın   → akan altın + hale + ışın
    efsane  → hepsi + holografik iç hat + güçlü hale + süpürme
*/

export type CardIdentity = {
  username: string;
  avatarUrl: string | null;
  level: number;
  /** İlçe adı; yoksa satır gizleniyor. */
  district: string | null;
};

type TierVisual = {
  frame: string;
  label: string;
  /** OVR ve istat sayılarının metal rengi. */
  text: string;
  rays: boolean;
  glow: "none" | "soft" | "strong";
  sweep: boolean;
  holoLine: boolean;
  /** Kademe etiketi holografik mi, yoksa kendi metalinde mi? */
  holoLabel: boolean;
  float: boolean;
};

const TIERS: Record<string, TierVisual> = {
  bronze: {
    frame: "vipcard-bronze",
    label: "BRONZ",
    text: "vip-bronze-text",
    rays: false,
    glow: "none",
    sweep: false,
    holoLine: false,
    holoLabel: false,
    float: false,
  },
  silver: {
    frame: "vipcard-silver",
    label: "GÜMÜŞ",
    text: "vip-silver-text",
    rays: false,
    glow: "soft",
    sweep: false,
    holoLine: false,
    holoLabel: false,
    float: false,
  },
  gold: {
    frame: "vipcard-gold",
    label: "ALTIN",
    text: "vip-gold-text",
    rays: true,
    glow: "soft",
    sweep: false,
    holoLine: true,
    holoLabel: true,
    float: true,
  },
  special: {
    frame: "vipcard-gold",
    label: "EFSANE",
    text: "vip-gold-text",
    rays: true,
    glow: "strong",
    sweep: true,
    holoLine: true,
    holoLabel: true,
    float: true,
  },
};

/** Türkiye bayrağı — saf CSS/SVG, dış varlık yok. */
function FlagTR({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 30 20"
      width={size}
      height={(size * 20) / 30}
      aria-hidden
      className="block"
    >
      <rect width="30" height="20" fill="#E30A17" />
      <circle cx="12" cy="10" r="5" fill="#fff" />
      <circle cx="13.6" cy="10" r="4" fill="#E30A17" />
      <path
        d="M18.4 10 l4.6-1.5 -2.85 3.9 0-4.8 2.85 3.9z"
        fill="#fff"
      />
    </svg>
  );
}

export function IdentityCard({
  identity,
  stats,
  size = "large",
}: {
  identity: CardIdentity;
  stats: UserStats;
  size?: "large" | "mini";
}) {
  const mini = size === "mini";
  const tier = TIERS[stats.tier] ?? TIERS.bronze;

  return (
    <article
      aria-label={`${identity.username} kimlik kartı, genel puan ${stats.ovr}, ${tier.label}`}
      className={`vipcard ${tier.frame} ${
        tier.float && !mini ? "vipcard-float" : ""
      } ${mini ? "w-[150px]" : "w-full max-w-[300px]"}`}
    >
      {/* ------------------------------------------------ katmanlar */}
      <span aria-hidden className="vipcard-frame" />
      {tier.holoLine ? (
        <span aria-hidden className="vipcard-hololine" />
      ) : null}
      <span aria-hidden className="vipcard-bg" />
      {tier.rays ? <span aria-hidden className="vipcard-rays" /> : null}
      {tier.glow !== "none" ? (
        <span
          aria-hidden
          className={`vipcard-glow ${
            tier.glow === "strong" ? "vipcard-glow-strong" : ""
          }`}
        />
      ) : null}
      <span aria-hidden className="vipcard-texture" />
      {tier.sweep ? <span aria-hidden className="vipcard-sweep" /> : null}

      {/* ------------------------------------------------ içerik */}
      <div
        className={`relative flex h-full flex-col ${
          mini ? "px-2 py-2" : "px-3.5 py-3"
        }`}
      >
        {/* Tepe: amblem */}
        <div className="flex flex-col items-center">
          <span
            className={`flex items-center justify-center rounded-full border border-[#d4a02c]/70 bg-black/30 ${
              mini ? "h-4 w-4" : "h-6 w-6"
            }`}
          >
            <span
              className={`vip-gold-text font-bold ${
                mini ? "text-[7px]" : "text-[10px]"
              }`}
            >
              G
            </span>
          </span>
          <span
            className={`vip-gold-text mt-0.5 font-bold ${
              mini ? "text-[6px] tracking-[0.2em]" : "text-[9px] tracking-[0.35em]"
            }`}
          >
            GENÇLİG
          </span>
        </div>

        {/* Orta bölüm: sol sütun + avatar */}
        <div
          className={`flex flex-1 items-center ${mini ? "gap-1" : "gap-2"}`}
        >
          {/* Sol sütun */}
          <div className="flex shrink-0 flex-col items-center">
            <span
              className={`${tier.text} font-bold leading-none ${
                mini ? "text-2xl" : "text-[44px]"
              }`}
            >
              {stats.ovr}
            </span>

            <span
              className={`mt-1 w-full border-y border-[#d4a02c]/40 py-0.5 text-center font-bold ${
                tier.holoLabel ? "vip-holo-text" : tier.text
              } ${mini ? "text-[6px] tracking-[0.1em]" : "text-[9px] tracking-[0.18em]"}`}
            >
              {tier.label}
            </span>

            <span
              className={`mt-1.5 overflow-hidden rounded-[2px] border border-[#d4a02c]/70 ${
                mini ? "" : ""
              }`}
            >
              <FlagTR size={mini ? 16 : 24} />
            </span>

            {identity.district ? (
              <span
                className={`mt-0.5 max-w-[56px] truncate text-center font-semibold uppercase tracking-wide text-white/70 ${
                  mini ? "text-[5px]" : "text-[8px]"
                }`}
              >
                {identity.district}
              </span>
            ) : null}
          </div>

          {/* Avatar + seviye madalyonu */}
          <div className="relative flex flex-1 items-center justify-center">
            <span
              className={`relative block overflow-hidden rounded-full border-2 border-[#d4a02c]/80 ${
                mini ? "h-[52px] w-[52px]" : "h-[92px] w-[92px]"
              }`}
              style={{
                boxShadow:
                  tier.glow === "none"
                    ? undefined
                    : "0 0 18px rgb(139 92 246 / 0.55)",
              }}
            >
              {identity.avatarUrl ? (
                <Image
                  src={identity.avatarUrl}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span
                  aria-hidden
                  className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-[#7c3aed] to-[#22d3ee] font-bold text-white ${
                    mini ? "text-xl" : "text-4xl"
                  }`}
                >
                  {identity.username.charAt(0).toUpperCase()}
                </span>
              )}
            </span>

            <span
              className={`absolute rounded-full border border-[#d4a02c] bg-[#0a0618] text-center font-bold text-[#f3d27a] ${
                mini
                  ? "-bottom-0.5 right-1 px-1 py-[1px] text-[5px]"
                  : "bottom-0 right-1 px-1.5 py-0.5 text-[8px]"
              }`}
            >
              SEVİYE {identity.level}
            </span>
          </div>
        </div>

        {/* Kullanıcı adı: asil serif, geniş harf aralığı, çizgi arasında */}
        <div className={mini ? "mt-0.5" : "mt-1.5"}>
          <span aria-hidden className="vip-rule block" />
          <p
            className={`vip-gold-text truncate py-1 text-center font-bold uppercase ${
              mini ? "text-[9px]" : "text-[15px]"
            }`}
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              letterSpacing: mini ? "2px" : "4.5px",
            }}
          >
            {identity.username}
          </p>
          <span aria-hidden className="vip-rule block" />
        </div>

        {/* Alt: 6 istat, 2 sütun × 3 satır, ortada dikey ayraç */}
        <div
          className={`relative grid grid-cols-2 ${
            mini ? "mt-1 gap-x-1.5 gap-y-0.5" : "mt-2 gap-x-3 gap-y-1"
          }`}
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#d4a02c]/25"
          />

          {STAT_META.map((meta) => {
            const value = stats[meta.key];
            return (
              <div key={meta.key} className="min-w-0">
                <div className="flex items-baseline gap-1">
                  <span
                    className={`${tier.text} font-bold tabular-nums ${
                      mini ? "text-[11px]" : "text-[17px]"
                    }`}
                  >
                    {value}
                  </span>
                  <span
                    className={`font-semibold tracking-wide text-white/65 ${
                      mini ? "text-[6px]" : "text-[9px]"
                    }`}
                  >
                    {meta.short}
                  </span>
                </div>

                {/* İnce dolan bar */}
                <span
                  aria-hidden
                  className={`mt-0.5 block w-full overflow-hidden rounded-full bg-white/12 ${
                    mini ? "h-[2px]" : "h-[3px]"
                  }`}
                >
                  <span
                    className="vip-statbar block h-full rounded-full"
                    style={{ width: `${value}%` }}
                  />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}
