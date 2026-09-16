/*
  Token görsel kimliği (D34 FAZ TK).

  ÖLÇÜLEN SORUN: Token 29 dosyada 60 ayrı yerde gösteriliyordu ve hepsi
  aynı soluk reçeteyi tekrarlıyordu: `bg-coin/15 text-coin` + lucide'ın
  düz `coins` çizgi ikonu. Koyu zeminde %15 opak sarı bir dolgu ile ince
  çizgili bir ikon, para birimi gibi değil "etiket" gibi okunuyordu.
  Oyunun ekonomisi olan şey, ekranın en silik öğesiydi.

  v2'de Token'ın üç parçası var ve üçü de BURADA:

    TokenIcon   — özel SVG jeton (dış altın halka, koyu iç, parıltı)
    TokenAmount — altın gradyanlı, tabular sayı
    TokenPill   — altın kenarlı, iç ışıltılı dolgun hap

  Tek kaynak olması şart: ikon lucide'dan gelseydi her ekran kendi
  boyutunu/kalınlığını seçerdi ve D31'de buton sisteminde çözdüğümüz
  dağınıklık burada tekrarlanırdı.
*/

/**
 * Altın jeton ikonu.
 *
 * Lucide'ın `coins` ikonu DEĞİL: o bir çizgi ikonu ve para birimi
 * ağırlığı taşımıyor. Buradaki jeton dolgun — dış altın halka, koyu
 * iç alan, sol üstte parıltı. Koyu zeminde de açık zeminde de aynı
 * okunuyor çünkü kendi kontrastını taşıyor.
 *
 * Kabartma hissi iki katmanla: dış halkada dikey gradyan (üstte açık,
 * altta koyu) ve iç alanda ters yönlü gradyan. Tek düz daire denendi
 * ve elendi — 14px'te "sarı nokta" gibi görünüyordu.
 */
export function TokenIcon({
  className = "h-4 w-4",
  /** Benzersiz gradyan kimliği; aynı sayfada birden çok jeton olabiliyor. */
  id,
}: {
  className?: string;
  id?: string;
}) {
  /*
    SVG gradyan kimlikleri BELGE genelinde tekil olmalı. Sayfada onlarca
    jeton var; sabit bir id kullanmak, ilk jetonun gradyanının hepsine
    uygulanması demek (tarayıcı ilk tanımı kullanıyor) — çalışıyor ama
    kırılgan. Çağıran isterse kendi id'sini veriyor.
  */
  const gid = id ?? "tk";

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={`${gid}-ring`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="0.45" stopColor="#f5b301" />
          <stop offset="1" stopColor="#c2660a" />
        </linearGradient>
        <linearGradient id={`${gid}-face`} x1="0" y1="1" x2="0.4" y2="0">
          <stop offset="0" stopColor="#ffd966" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
      </defs>

      {/* Dış halka */}
      <circle cx="12" cy="12" r="10" fill={`url(#${gid}-ring)`} />
      {/* İç yüz: halkadan biraz küçük, ters gradyan — kabartma. */}
      <circle cx="12" cy="12" r="7.4" fill={`url(#${gid}-face)`} />
      {/* Kenar çizgisi: açık zeminde jetonun sınırı kaybolmasın. */}
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="#a1540b"
        strokeWidth="1"
        opacity="0.55"
      />
      {/* Parıltı: sol üstte ince yay. */}
      <path
        d="M6.6 8.4a7.4 7.4 0 0 1 4.6-3.3"
        fill="none"
        stroke="#fffdf3"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.8"
      />
      {/* Merkez işareti: jetonun "damgası". */}
      <circle cx="12" cy="12" r="2.6" fill="#a1540b" opacity="0.32" />
    </svg>
  );
}

/**
 * Token miktarı — altın gradyanlı sayı.
 *
 * `tabular-nums` şart: bakiye sayacı artarken rakam genişliği
 * değişiyordu ve HUD'daki sayı her güncellemede zıplıyordu.
 *
 * Gradyan METİN (background-clip: text) tercih edildi; düz `#f5b301`
 * koyu zeminde hardal gibi okunuyor ve "metal" hissi vermiyor.
 */
export function TokenAmount({
  value,
  prefix = "",
  className = "",
}: {
  value: number | string;
  prefix?: string;
  className?: string;
}) {
  return (
    <span className={`token-amount tabular-nums ${className}`}>
      {prefix}
      {typeof value === "number" ? value.toLocaleString("tr-TR") : value}
    </span>
  );
}

export type TokenPillSize = "sm" | "md" | "lg";

/*
  Boyutlar. Sınıflar TAM METİN yazılı: Tailwind kaynağı tarayarak sınıf
  üretiyor ve kurulmuş bir ad (`px-${n}`) derlemeye hiç girmiyor.
*/
const PILL: Record<TokenPillSize, string> = {
  sm: "gap-1 px-1.5 py-0.5 text-[10px]",
  md: "gap-1 px-2.5 py-1 text-xs",
  lg: "gap-1.5 px-3 py-1.5 text-sm",
};

const ICON: Record<TokenPillSize, string> = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

/**
 * Token hapı — altın kenar + iç ışıltı.
 *
 * Koyu zeminde okunurluk için dolgu opak değil ama kenar TAM altın:
 * %15 opak dolgu + soluk metin kombinasyonu (eski hâli) 13px'te
 * neredeyse görünmüyordu.
 */
export function TokenPill({
  value,
  prefix = "+",
  unit = true,
  size = "md",
  className = "",
  iconId,
}: {
  value: number;
  prefix?: string;
  /**
   * Birim yazısı ("Token"). Dar yerlerde (görev kutucuğu ızgarası)
   * kapatılabiliyor; orada jeton zaten birimi anlatıyor ve metin
   * kutucuğu taşırıyordu.
   */
  unit?: boolean;
  size?: TokenPillSize;
  className?: string;
  iconId?: string;
}) {
  return (
    <span
      className={`token-pill inline-flex items-center rounded-full font-bold ${PILL[size]} ${className}`}
    >
      <TokenIcon className={`${ICON[size]} shrink-0`} id={iconId} />
      <TokenAmount value={value} prefix={prefix} />
      {unit ? <span className="token-amount">Token</span> : null}
    </span>
  );
}
