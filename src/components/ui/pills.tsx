import { Icon } from "./icon";

/*
  Ortak "hap" bileşenleri.

  XP ve Coin her ekranda aynı görünmeli; renk ve ikon seçimini her sayfada
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
}: {
  value: number;
  prefix?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-coin/15 px-2.5 py-1 text-xs font-semibold text-coin ${className}`}
    >
      <Icon name="coins" className="h-3.5 w-3.5" />
      {prefix}
      {value}
    </span>
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
  tone = "from-brand to-teal",
  size = "md",
}: {
  icon: string | null | undefined;
  tone?: string;
  size?: "sm" | "md" | "lg";
}) {
  const box =
    size === "lg" ? "h-16 w-16" : size === "sm" ? "h-9 w-9" : "h-12 w-12";
  const glyph =
    size === "lg" ? "h-7 w-7" : size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} text-white`}
    >
      <Icon name={icon} className={glyph} />
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
