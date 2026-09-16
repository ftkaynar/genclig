import { Icon } from "./icon";
import { TokenPill } from "./token";

/*
  Ortak "hap" bileşenleri.

  XP ve Token her ekranda aynı görünmeli; renk ve ikon seçimini her sayfada
  tekrarlamak, biri değiştiğinde diğerlerinin geride kalması demekti.
*/

export function XpPill({
  value,
  prefix = "+",
  className = "",
}: {
  value: number;
  prefix?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-xp/15 px-2.5 py-1 text-xs font-semibold text-xp ${className}`}
    >
      <Icon name="zap" className="h-3.5 w-3.5" />
      {prefix}
      {value} XP
    </span>
  );
}

export function CoinPill({
  value,
  prefix = "+",
  className = "",
  unit = true,
}: {
  value: number;
  prefix?: string;
  className?: string;
  /**
   * Birim yazısı ("Token"). Dar yerlerde (görev kutucuğu ızgarası)
   * kapatılabiliyor; orada ikon zaten birimi anlatıyor ve metin
   * kutucuğu taşırıyordu.
   */
  unit?: boolean;
}) {
  /*
    D34 FAZ TK: Token kimliği TokenPill'e devredildi.

    CoinPill adı KORUNDU — 29 dosyada 60 kullanım var ve hepsini tek
    dilimde yeniden adlandırmak, görsel bir dilimi dosya taşımaya
    çevirirdi. Burada artık yalnız yeni bileşene yönlendirme var;
    eski soluk reçete (bg-coin/15 + text-coin + lucide coins) kalktı.
  */
  return (
    <TokenPill
      value={value}
      prefix={prefix}
      unit={unit}
      size="md"
      className={className}
    />
  );
}

/** Kalan süre hapı; anlık görevlerde kullanılıyor. */
export function TimerPill({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-status-warning/15 px-2.5 py-1 text-[11px] font-semibold text-status-warning ${className}`}
    >
      <Icon name="timer" className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

/**
 * Zorluk göstergesi: üç nokta, dolu olanlar seviyeyi anlatıyor.
 * Metin yerine nokta, kart üzerinde daha az yer kaplıyor ve dilden bağımsız.
 */
export function DifficultyDots({
  difficulty,
  className = "",
}: {
  difficulty: string;
  className?: string;
}) {
  const filled = difficulty === "hard" ? 3 : difficulty === "medium" ? 2 : 1;
  const label =
    difficulty === "hard" ? "Zor" : difficulty === "medium" ? "Orta" : "Kolay";

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      title={`Zorluk: ${label}`}
    >
      <span className="sr-only">Zorluk: {label}</span>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          aria-hidden
          className={
            index < filled
              ? "h-1.5 w-1.5 rounded-full bg-primary"
              : "h-1.5 w-1.5 rounded-full bg-edge"
          }
        />
      ))}
    </span>
  );
}

/** İkonlu yuvarlak görev/kategori amblemi. */
export function IconBadge({
  icon,
  tone = "from-indigo to-primary",
  size = "md",
}: {
  icon: string | null | undefined;
  tone?: string;
  size?: "sm" | "md" | "card" | "lg";
}) {
  // v2: chip'ler büyüdü ve ikon çizgisi kalınlaştı; küçük ince ikonlar
  // koyu zeminde silik duruyordu. "card" (44px) görev kartı için ayrı bir
  // kademe: 40px kart içinde zayıf, 56px ise başlığı aşağı itiyordu.
  const box =
    size === "lg"
      ? "h-14 w-14"
      : size === "card"
        ? "h-11 w-11"
        : size === "sm"
          ? "h-9 w-9"
          : "h-10 w-10";
  const glyph =
    size === "lg"
      ? "h-7 w-7"
      : size === "card"
        ? "h-[22px] w-[22px]"
        : size === "sm"
          ? "h-4 w-4"
          : "h-5 w-5";

  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} text-white`}
    >
      <Icon name={icon} className={glyph} strokeWidth={2.25} />
    </span>
  );
}

/** İkonlu boş durum bloğu. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-edge bg-card px-5 py-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-ink-muted">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
