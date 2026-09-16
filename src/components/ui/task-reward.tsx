import { Icon } from "./icon";
import { TokenAmount, TokenIcon } from "./token";

/*
  Görev ödül hapları — TEK bileşen (D34 FAZ XP).

  ÖLÇÜLEN SORUN: aynı iki hap (XP + Token) altı ayrı yerde altı ayrı
  reçeteyle yazılıyordu:

    task-tile.tsx        bg-xp / bg-coin, text-[10px], px-1.5
    spotlight-band.tsx   bg-xp / bg-coin, text-[11px], px-2
    chain-strip.tsx      bg-xp / bg-coin, text-[10px], px-1.5
    zincirler/[id]       bg-xp / bg-coin, text-[11px], px-2
    featured-task.tsx    XpPill / CoinPill (bambaşka görsel dil)
    task-card.tsx        XpPill / CoinPill

  Ana sayfadaki "önerilen" şeridinde ve /gorevler ızgarasında haplar
  diğer ekranlardakinden SOLUK ve KÜÇÜK kalıyordu; aynı görev iki
  ekranda iki farklı değerde görünüyordu.

  Artık hangi yüzeyde olursa olsun ödül aynı: XP cyan gradyan, Token
  altın jeton. Boyut değişiyor, KİMLİK değişmiyor.
*/

export type RewardSize = "sm" | "md" | "lg";

/*
  Sınıflar TAM METİN: Tailwind kaynağı tarayarak sınıf üretiyor ve
  kurulmuş bir ad (`text-[${n}px]`) derlemeye hiç girmiyor.
*/
const PILL: Record<RewardSize, string> = {
  sm: "gap-0.5 px-1.5 py-0.5 text-[10px]",
  md: "gap-1 px-2 py-0.5 text-[11px]",
  lg: "gap-1 px-2.5 py-1 text-xs",
};

const ICON: Record<RewardSize, string> = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
};

/** XP hapı: cyan gradyan, koyu metin. */
export function XpReward({
  value,
  prefix = "+",
  size = "md",
  className = "",
}: {
  value: number;
  prefix?: string;
  size?: RewardSize;
  className?: string;
}) {
  return (
    <span
      className={`xp-solid inline-flex items-center rounded-full font-extrabold ${PILL[size]} ${className}`}
    >
      <Icon name="zap" className={`${ICON[size]} shrink-0`} />
      <span className="tabular-nums">
        {prefix}
        {value}
      </span>
    </span>
  );
}

/** Token hapı: altın gradyan, jeton ikonu, koyu metin. */
export function TokenReward({
  value,
  prefix = "+",
  size = "md",
  className = "",
  iconId,
}: {
  value: number;
  prefix?: string;
  size?: RewardSize;
  className?: string;
  iconId?: string;
}) {
  return (
    <span
      className={`token-solid inline-flex items-center rounded-full font-extrabold ${PILL[size]} ${className}`}
    >
      <TokenIcon className={`${ICON[size]} shrink-0`} id={iconId} />
      <span className="tabular-nums">
        {prefix}
        {value}
      </span>
    </span>
  );
}

/**
 * İkisi yan yana — görev kartlarının standart ödül gösterimi.
 *
 * `strike` verildiğinde (Günün Görevi) normal değer üstü çizili olarak
 * yanında duruyor: yalnız çift değeri göstermek "bu görev zaten böyle
 * değerliymiş" diye okunuyordu (D33'te ölçülmüştü).
 */
export function TaskReward({
  xp,
  coin,
  size = "md",
  strikeXp,
  strikeCoin,
  className = "",
}: {
  xp: number;
  coin: number;
  size?: RewardSize;
  /** Üstü çizili gösterilecek normal XP (2x durumunda). */
  strikeXp?: number;
  strikeCoin?: number;
  className?: string;
}) {
  return (
    <span className={`flex flex-wrap items-center gap-1 ${className}`}>
      <XpReward value={xp} size={size} />
      {strikeXp !== undefined ? (
        <s className="text-[10px] font-bold text-ink-muted">+{strikeXp}</s>
      ) : null}

      <TokenReward value={coin} size={size} />
      {strikeCoin !== undefined ? (
        <s className="text-[10px] font-bold text-ink-muted">+{strikeCoin}</s>
      ) : null}
    </span>
  );
}

/**
 * Token bakiyesi/miktarı — hap değil, düz metin.
 *
 * Ödül dışı yerlerde (bakiye, fiyat, ayar tablosu) kullanılıyor:
 * her sayının hap olması gerekmiyor, ama altın kimliği korunmalı.
 */
export function TokenText({
  value,
  size = "md",
  className = "",
  iconId,
}: {
  value: number | string;
  size?: RewardSize;
  className?: string;
  iconId?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 font-bold ${className}`}>
      <TokenIcon className={`${ICON[size]} shrink-0`} id={iconId} />
      <TokenAmount value={value} />
    </span>
  );
}
