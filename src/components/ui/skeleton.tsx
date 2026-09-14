/*
  Yükleme iskeletleri.

  Algılanan hız için: sunucu verisi gelene kadar boş beyaz ekran yerine
  sayfanın şekli görünüyor. Gradyan parıltı `genclig-shimmer` ile;
  `prefers-reduced-motion` altında parıltı durur, iskelet düz kalır.
*/

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`skeleton block ${className}`} />;
}

/** Görev/ödül listelerindeki satır kartının iskeleti. */
export function SkeletonCard() {
  return (
    <li className="flex gap-3 rounded-2xl border border-edge bg-card p-3.5">
      <SkeletonBlock className="h-14 w-14 shrink-0 rounded-2xl" />
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <SkeletonBlock className="h-3 w-24 rounded-full" />
        <SkeletonBlock className="h-4 w-full rounded-full" />
        <span className="flex gap-2">
          <SkeletonBlock className="h-5 w-16 rounded-full" />
          <SkeletonBlock className="h-5 w-14 rounded-full" />
        </span>
      </span>
    </li>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <ul className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </ul>
  );
}

/** Ana sayfa ve profil hero alanının iskeleti. */
export function SkeletonHero() {
  return (
    <div className="rounded-3xl border border-edge bg-card p-5">
      <div className="flex items-center gap-3">
        <SkeletonBlock className="h-11 w-11 shrink-0 rounded-full" />
        <span className="flex flex-col gap-2">
          <SkeletonBlock className="h-3 w-16 rounded-full" />
          <SkeletonBlock className="h-4 w-32 rounded-full" />
        </span>
      </div>
      <SkeletonBlock className="mt-4 h-16 w-full rounded-2xl" />
    </div>
  );
}

/** Sekme/çip satırının iskeleti. */
export function SkeletonChips({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonBlock key={index} className="h-7 w-20 rounded-full" />
      ))}
    </div>
  );
}
