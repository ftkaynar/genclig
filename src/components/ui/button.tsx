import Link from "next/link";

import { Icon } from "@/components/ui/icon";

/*
  Tek buton sistemi (D31 FAZ B).

  ÖNCEKİ DURUM: 130 ham `<button className="...">` ve 39 dosyada
  `btn-chunky`. Her ekran kendi dolgusunu, yarıçapını, gölgesini ve
  yazı kalınlığını yazıyordu; aynı önemdeki iki aksiyon iki ekranda iki
  ayrı şekilde görünüyordu ve bir tanesi değiştiğinde diğerleri geride
  kalıyordu.

  Artık tek kaynak: varyant + boyut. Yeni bir ekran buton yazarken
  "hangi varyant" sorusuna cevap veriyor, "hangi gölge" sorusuna değil.

  Bileşen hem <button> hem <Link> basabiliyor (`href` verilirse):
  görsel olarak aynı olan iki öğenin iki ayrı stil tanımı olması, tam
  olarak kaçındığımız şeydi.
*/

/*
  Varyant listesi iki kümeden oluşuyor:

  ÖNEM varyantları (primary/secondary/danger/ghost) — aksiyonun
  ağırlığını söylüyor.

  KİMLİK varyantları (gold/cyan/magenta/emerald/indigo) — hedef
  ekranın rengini taşıyor (lib/ui/accents.ts). Bunlar birincil
  aksiyonun YERİNE geçmiyor; bir ekrana götüren düğmenin o ekranla
  aynı renkte olması için var. 'violet' ayrı bir varyant DEĞİL:
  markanın mor birincil butonu zaten o kimlik.
*/
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "gold"
  | "cyan"
  | "magenta"
  | "emerald"
  | "indigo"
  | "danger"
  | "ghost";

export type ButtonSize = "sm" | "md" | "lg";

/*
  Varyantlar.

  Sınıflar TAM METİN yazılı: Tailwind kaynağı tarayarak sınıf üretiyor ve
  kurulmuş bir ad (`bg-${tone}`) derlemeye hiç girmiyor. Aynı kural
  lib/tasks/labels.ts ve lib/profile/badge-tones.ts için de geçerli.
*/
const VARIANT: Record<ButtonVariant, string> = {
  /*
    Birincil aksiyon. Gradyan + belirgin gölge + üstte ince iç parlak
    hat: yüzeyin "basılabilir" olduğunu ışık yönüyle anlatıyor. Düz renk
    bir dikdörtgen bu ölçekte etiket gibi okunuyordu.
  */
  primary:
    "btn-surface btn-primary text-white",
  /*
    İkincil. Soluk gri DEĞİL: koyu kart zemini + canlı indigo kenar.
    Önceki ikincil butonlar `border-edge text-ink-muted` idi ve pasif
    görünüyordu — kullanıcı tıklanabilir olduğunu anlamıyordu.
  */
  secondary:
    "btn-surface border-[1.5px] border-indigo/70 bg-card text-white hover:border-indigo hover:bg-surface",
  /** Token/ödül aksiyonları: altın, koyu metin. */
  gold: "btn-surface btn-gold text-[#3a2a00]",
  /*
    Kimlik varyantları. Cyan ve altın gibi açık zeminlerde metin
    KOYU: beyaz metin bu iki ton üzerinde WCAG AA'yı geçmiyor
    (ölçüldü: cyan #22d3ee üzerinde beyaz 1.9:1).
  */
  cyan: "btn-surface btn-cyan text-[#06283a]",
  magenta: "btn-surface btn-magenta text-white",
  emerald: "btn-surface btn-emerald text-white",
  indigo: "btn-surface btn-indigo text-white",
  danger:
    "btn-surface border-[1.5px] border-status-danger/60 bg-status-danger/10 text-status-danger hover:bg-status-danger/20",
  /** Yalnız metin; yine de dokunma alanı ve hover'ı var. */
  ghost: "text-ink-muted hover:bg-surface hover:text-ink",
};

/*
  Boyutlar. En küçüğü bile 40px: bundan küçük dokunma hedefi telefonda
  ıskalanıyor (D30 FAZ SR'de sıralama çiplerinde ölçülmüştü).
*/
const SIZE: Record<ButtonSize, string> = {
  sm: "min-h-[40px] px-3.5 text-[13px]",
  md: "min-h-[44px] px-5 text-sm",
  lg: "min-h-[52px] px-6 text-base",
};

type CommonProps = {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Tam genişlik (form altı birincil aksiyonlar). */
  block?: boolean;
  /** Metnin solunda ikon. */
  icon?: string;
  /** Metnin sağında ikon (ör. chevron). */
  iconEnd?: string;
  className?: string;
};

function classesFor({
  variant = "primary",
  size = "md",
  block,
  className = "",
  disabled,
}: CommonProps & { disabled?: boolean }) {
  return [
    "relative inline-flex items-center justify-center gap-2 rounded-[14px] font-bold",
    "transition-[transform,box-shadow,filter,background-color,border-color]",
    "duration-[var(--motion-fast)] ease-out",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta",
    VARIANT[variant],
    SIZE[size],
    block ? "w-full" : "",
    /*
      Devre dışı buton OKUNUR kalıyor: opaklık .55 ve kilit ikonu.
      Silik gri bir buton "bozuk" gibi görünüyor ve kullanıcı neden
      basamadığını anlamıyordu.
    */
    disabled ? "cursor-not-allowed opacity-55" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  block,
  icon,
  iconEnd,
  className,
  disabled,
  type = "button",
  ...rest
}: CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={classesFor({
        children,
        variant,
        size,
        block,
        className,
        disabled,
      })}
      {...rest}
    >
      {/* Devre dışı durumda kilit: sebebi renkten bağımsız anlatıyor. */}
      {disabled ? (
        <Icon name="lock" className="h-4 w-4 shrink-0" />
      ) : icon ? (
        <Icon name={icon} className="h-4 w-4 shrink-0" />
      ) : null}
      <span className="min-w-0 truncate">{children}</span>
      {iconEnd ? (
        <Icon name={iconEnd} className="h-4 w-4 shrink-0" />
      ) : null}
    </button>
  );
}

/** Aynı görünüm, bağlantı olarak. */
export function ButtonLink({
  children,
  href,
  variant = "primary",
  size = "md",
  block,
  icon,
  iconEnd,
  className,
  ...rest
}: CommonProps &
  Omit<React.ComponentProps<typeof Link>, "className" | "children">) {
  return (
    <Link
      href={href}
      className={classesFor({ children, variant, size, block, className })}
      {...rest}
    >
      {icon ? <Icon name={icon} className="h-4 w-4 shrink-0" /> : null}
      <span className="min-w-0 truncate">{children}</span>
      {iconEnd ? <Icon name={iconEnd} className="h-4 w-4 shrink-0" /> : null}
    </Link>
  );
}
