import Image from "next/image";

import {
  DECAY_GRACE_DAYS,
  STAT_META,
  inactiveDays,
  type UserStats,
} from "@/lib/stats/labels";

/*
  GENÇLİG Kimlik Kartı — VIP, kalkan siluet.

  TASARIM ÖZGÜN: referans olarak verilen ticari karttan yalnızca genel
  SİLUET ve yerleşim mantığı (sol sütunda genel puan, sağda portre, altta
  iki sütunlu istat tablosu) alındı — bu düzen spor kartlarının ortak
  dili. Hiçbir görsel, logo, marka, renk paleti ya da ticari font
  kullanılmadı; yüzeyler saf CSS gradyanı, tipografi sistem serif'i,
  bayrak elle çizilmiş SVG.

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

/*
  Kalkan siluetinin iç boşlukları.

  Üstteki V çentik ve alttaki sivri uç içeriği kırpıyor; bu yüzden dikey
  paylar yüzdeyle değil piksel sabitleriyle veriliyor. Yüzde dolgu
  CSS'te YÜKSEKLİĞE değil GENİŞLİĞE göre çözülüyor ve kalkanın oranı
  değişince paylar kayıyordu.
*/
const BOX = {
  large: {
    width: 320,
    padTop: 54,
    padBottom: 66,
    padX: 26,
    ovr: "text-[52px]",
    tierLabel: "text-[10px] tracking-[0.2em]",
    avatar: 104,
    name: "text-[17px]",
    nameSpacing: "5px",
    statValue: "text-[22px]",
    statLabel: "text-[11px]",
    /* İki haneli en geniş sayı + pay; "99" ile "9" aynı yerde biter. */
    statNumWidth: 30,
    statLabelWidth: 30,
    flag: 28,
    district: "text-[9px]",
    wordmark: "text-[8px] tracking-[0.3em]",
  },
  mini: {
    width: 160,
    padTop: 27,
    padBottom: 33,
    padX: 13,
    ovr: "text-[26px]",
    tierLabel: "text-[6px] tracking-[0.12em]",
    avatar: 52,
    name: "text-[10px]",
    nameSpacing: "2px",
    statValue: "text-[12px]",
    statLabel: "text-[7px]",
    statNumWidth: 17,
    statLabelWidth: 18,
    flag: 16,
    district: "text-[6px]",
    wordmark: "text-[5px] tracking-[0.2em]",
  },
} as const;

/** Türkiye bayrağı — elle çizilmiş SVG, dış varlık yok. */
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
      <path d="M18.4 10 l4.6-1.5 -2.85 3.9 0-4.8 2.85 3.9z" fill="#fff" />
    </svg>
  );
}

export function IdentityCard({
  identity,
  stats,
  size = "large",
  season = null,
}: {
  identity: CardIdentity;
  stats: UserStats;
  size?: "large" | "mini";
  /**
   * Aktif sezon etiketi (D33 FAZ SZ).
   *
   * VIP tasarımına DOKUNULMUYOR: yalnız alt köşede ince bir şerit.
   * Kart bu ürünün en çok emek verilmiş görseli; sezonu büyük bir
   * rozetle duyurmak onu bozardı. Mini kartta hiç gösterilmiyor —
   * 160px'te okunmuyor.
   */
  season?: { name: string; stripe: string } | null;
}) {
  const mini = size === "mini";
  const box = mini ? BOX.mini : BOX.large;
  const tier = TIERS[stats.tier] ?? TIERS.bronze;

  /*
    Soğuma rozeti: istatlar düşmeye BAŞLADIYSA görünüyor (7 gün).
    Küçük ve tek satır — abartılmadı; kart bir ceza ekranı değil,
    rozet yalnızca "neden düştü" sorusunu peşinen yanıtlıyor.
    Mini kartta hiç gösterilmiyor: 160px’te okunmuyor ve mini kart
    çoğunlukla başkasının kartı.
  */
  const idle = inactiveDays(stats.last_activity_at);
  const cooling = !mini && idle !== null && idle > DECAY_GRACE_DAYS;

  return (
    <article
      aria-label={`${identity.username} kimlik kartı, genel puan ${stats.ovr}, ${tier.label}`}
      className={`vipcard ${tier.frame} ${
        tier.float && !mini ? "vipcard-float" : ""
      }`}
      style={{ width: box.width }}
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
        className="relative flex h-full flex-col"
        style={{
          paddingTop: box.padTop,
          paddingBottom: box.padBottom,
          paddingLeft: box.padX,
          paddingRight: box.padX,
        }}
      >
        {/* Üst blok: sol sütun + portre */}
        <div className={`flex items-start ${mini ? "gap-1" : "gap-2"}`}>
          <div className="flex shrink-0 flex-col items-center">
            <span
              className={`${tier.text} font-bold leading-none ${box.ovr}`}
            >
              {stats.ovr}
            </span>

            <span
              className={`mt-0.5 w-full text-center font-bold ${
                tier.holoLabel ? "vip-holo-text" : tier.text
              } ${box.tierLabel}`}
            >
              {tier.label}
            </span>

            <span
              aria-hidden
              className={`vip-rule ${mini ? "my-1" : "my-1.5"} w-full`}
            />

            {cooling ? (
              <span
                title={`${idle} gündür eylem yok, istatların soğuyor`}
                className="mb-1 rounded-full bg-[#38bdf8]/20 px-1.5 py-[1px] text-[8px] font-bold tracking-wide text-[#7dd3fc]"
              >
                SOĞUYOR
              </span>
            ) : null}

            {/*
              Bayrak + ilçe TEK madalyonda.

              ÖNCEKİ SORUN: bayrak ile ilçe adı iki ayrı öğeydi ve
              yapışık duruyordu; ilçe adı bayrağın altına kaçmış bir
              alt yazı gibi okunuyordu. Şimdi çerçeveli bir rozet:
              üstte bayrak, altında ince ayraç, altında altın harf
              aralıklı ilçe adı. İlçe yoksa madalyon yalnız bayrakla
              ve daha dar kalıyor — boş bir alt bölme bırakmıyor.
            */}
            <span
              className={`flex flex-col items-center rounded-lg border border-[#d4a02c]/55 bg-black/25 ${
                mini ? "gap-0.5 px-1 py-1" : "gap-1 px-2 py-1.5"
              }`}
            >
              <span className="overflow-hidden rounded-[2px] border border-[#d4a02c]/70">
                <FlagTR size={box.flag} />
              </span>

              {identity.district ? (
                <>
                  <span
                    aria-hidden
                    className="block h-px w-full bg-[#d4a02c]/40"
                  />
                  <span
                    className={`vip-gold-text max-w-[74px] truncate text-center font-bold uppercase ${box.district}`}
                    style={{ letterSpacing: mini ? "0.5px" : "1px" }}
                  >
                    {identity.district}
                  </span>
                </>
              ) : null}
            </span>
          </div>

          {/* Portre + seviye madalyonu */}
          <div className="relative flex flex-1 justify-center">
            <span
              className="relative block overflow-hidden rounded-full border-2 border-[#d4a02c]/80"
              style={{
                width: box.avatar,
                height: box.avatar,
                boxShadow:
                  tier.glow === "none"
                    ? undefined
                    : "0 0 20px rgb(139 92 246 / 0.6)",
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
                  ? "-bottom-1 right-0 px-1 py-[1px] text-[5px]"
                  : "-bottom-1.5 right-1 px-2 py-0.5 text-[9px]"
              }`}
            >
              SEVİYE {identity.level}
            </span>
          </div>
        </div>

        {/* Ad: serif, geniş harf aralığı, altında ayraç */}
        <p
          className={`vip-gold-text ${
            mini ? "mt-2" : "mt-4"
          } truncate text-center font-bold uppercase ${box.name}`}
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            letterSpacing: box.nameSpacing,
          }}
        >
          {identity.username}
        </p>
        <span
          aria-hidden
          className={`vip-rule ${mini ? "mt-1" : "mt-1.5"} w-full`}
        />

        {/*
          İstatlar: iki sütun × üç satır, "94 HIZ" düzeninde — sayı önce,
          kısaltma sonra. Bar göstergesi bilerek yok: referans düzende
          sayılar tek başına duruyor ve kalkanın dar alt alanında barlar
          tabloyu boğuyordu. Bar detayı kartın arka yüzünde duruyor.
        */}
        <div
          className={`relative grid flex-1 grid-cols-2 content-center justify-items-center ${
            mini ? "mt-1.5 gap-x-2 gap-y-1" : "mt-3 gap-x-4 gap-y-2"
          }`}
        >
          <span
            aria-hidden
            className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-[#d4a02c]/30"
          />

          {/*
            HİZA: sayı sabit genişlikte ve SAĞA dayalı, kısaltma sol
            hizalı ve sabit genişlikte. Böylece "9" ile "87" aynı
            sütunda bitiyor ve altı kısaltma tek bir dikey çizgide
            başlıyor. Önceden ikisi de ortalanıyordu; sayı bir
            haneden iki haneye çıkınca kısaltma yana kayıyor ve iki
            sütunun ritmi bozuluyordu.

            `tabular-nums` rakamları eşit genişliğe getiriyor —
            orantılı rakamlarda 1 ile 8 farklı genişlikte ve sabit
            kutu tek başına yetmiyordu.
          */}
          {STAT_META.map((meta) => (
            <div
              key={meta.key}
              className={`flex items-baseline ${mini ? "gap-1" : "gap-1.5"}`}
            >
              <span
                className={`${tier.text} shrink-0 text-right font-bold tabular-nums ${box.statValue}`}
                style={{ width: box.statNumWidth }}
              >
                {stats[meta.key]}
              </span>
              <span
                className={`shrink-0 font-semibold tracking-wide text-white/75 ${box.statLabel}`}
                style={{ width: box.statLabelWidth }}
              >
                {meta.short}
              </span>
            </div>
          ))}
        </div>

        {/* Alt: marka yazısı (referanstaki alt logo yerinde) */}
        <span
          className={`vip-gold-text ${
            mini ? "mt-1" : "mt-2"
          } text-center font-bold ${box.wordmark}`}
        >
          GENÇLİG
        </span>

        {/* Sezon şeridi: alt köşede, tek satır, minimal. */}
        {season && !mini ? (
          <span
            className={`absolute bottom-1.5 right-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider ${season.stripe}`}
          >
            {season.name}
          </span>
        ) : null}
      </div>
    </article>
  );
}
