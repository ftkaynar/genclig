/*
  Sürekli görev rozeti (D35 FAZ K).

  ÖNCEKİ DURUM: gri bir hapta lucide'ın `activity` ikonu (nabız çizgisi)
  ve "Sürekli" yazısı vardı. Nabız çizgisi "canlı/aktif" anlatıyor,
  TEKRARLANABİLİRLİK anlatmıyor — kullanıcı için bu görevin her gün
  yeniden yapılabildiği bilgisi kayboluyordu.

  v2: yeşil yuvarlak rozet, içinde İKİ DAİRESEL OK (geri dönüşüm dili).
  Döngü sembolü evrensel olarak "tekrar" demek.

  İkon özel SVG, lucide DEĞİL: `refresh-cw` tek kalınlıkta ince çizgi ve
  16px'te ok uçları kayboluyordu. Buradaki iki yay daha kalın ve uçları
  dolgun üçgen — küçük boyutta da "dönüyor" okunuyor.
*/

/** İki dairesel ok — tekrar/döngü. */
export function LoopIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden
      focusable="false"
    >
      {/* Üst yay: soldan sağa */}
      <path d="M4.5 10.5a7.5 7.5 0 0 1 12.6-3.4" />
      {/* Üst ok ucu */}
      <path d="M17.6 3.4v3.9h-3.9" strokeLinejoin="round" />
      {/* Alt yay: sağdan sola */}
      <path d="M19.5 13.5a7.5 7.5 0 0 1-12.6 3.4" />
      {/* Alt ok ucu */}
      <path d="M6.4 20.6v-3.9h3.9" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * "Sürekli" rozeti.
 *
 * `compact` kart ızgarasında: 160px'te metin kutucuğu taşırıyordu, orada
 * yalnız yuvarlak ikon duruyor ve `title` ile anlamı taşıyor.
 */
export function ContinuousBadge({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <span
        title="Sürekli görev — her gün tekrar yapılabilir"
        className={`loop-badge inline-flex h-5 w-5 items-center justify-center rounded-full text-white ${className}`}
      >
        <LoopIcon className="h-3 w-3" />
      </span>
    );
  }

  return (
    <span
      className={`loop-badge inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${className}`}
    >
      <LoopIcon className="h-3 w-3" />
      Sürekli
    </span>
  );
}
