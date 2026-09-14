/*
  Rozet renkleri.

  ÖNCEKİ DURUM: kazanılmış her rozet aynı altın (coin) tonundaydı,
  kilitliler ise tek tip griydi. Izgara tek renkli görünüyordu; kullanıcı
  hangi rozetin hangisi olduğunu ancak yazıyı okuyarak ayırt edebiliyordu.

  Artık her rozetin kendi tonu var. Renk slug'a bağlı ve anlamla seçildi
  (çevre yeşil, sosyal magenta, kupa altın...), rastgele değil.

  Sınıf adları TAM METİN yazılı. Tailwind kaynağı tarayarak sınıf üretiyor;
  `bg-${tone}/20` gibi kurulmuş bir ad derlemeye hiç girmez. Aynı kural
  lib/tasks/labels.ts içindeki CATEGORY_TONE için de geçerli.

  Bu dosya saf veri — `next/headers` çeken bir modüle bağlanmıyor, çünkü
  rozet ızgarası bir client bileşeni ve queries.ts'ten import etmek sunucu
  API'sini tarayıcı paketine sokardı.
*/

export type BadgeTone = {
  /** Kazanılmış rozetin kart çerçevesi ve zemini. */
  card: string;
  /** Kazanılmış rozetin ikon kutusu. */
  box: string;
  /** Kilitli rozetin ikon kutusu: aynı renk, kısılmış. */
  lockedBox: string;
  /** Kazanılma tarihi yazısı. */
  text: string;
  /** Seviye Yolu'ndaki kilometre taşı hapı. */
  chip: string;
};

const CYAN: BadgeTone = {
  card: "border-cyan/50 bg-cyan/10",
  box: "bg-cyan/20 text-cyan",
  lockedBox: "bg-cyan/10 text-cyan/45",
  text: "text-cyan",
  chip: "bg-cyan/15 text-cyan",
};

const GREEN: BadgeTone = {
  card: "border-status-success/50 bg-status-success/10",
  box: "bg-status-success/20 text-status-success",
  lockedBox: "bg-status-success/10 text-status-success/45",
  text: "text-status-success",
  chip: "bg-status-success/15 text-status-success",
};

const INDIGO: BadgeTone = {
  card: "border-indigo/50 bg-indigo/10",
  box: "bg-indigo/20 text-indigo",
  lockedBox: "bg-indigo/10 text-indigo/45",
  text: "text-indigo",
  chip: "bg-indigo/15 text-indigo",
};

const MAGENTA: BadgeTone = {
  card: "border-magenta/50 bg-magenta/10",
  box: "bg-magenta/20 text-magenta",
  lockedBox: "bg-magenta/10 text-magenta/45",
  text: "text-magenta",
  chip: "bg-magenta/15 text-magenta",
};

const VIOLET: BadgeTone = {
  card: "border-primary/50 bg-primary/10",
  box: "bg-primary/20 text-primary",
  lockedBox: "bg-primary/10 text-primary/45",
  text: "text-primary",
  chip: "bg-primary/15 text-primary",
};

const AMBER: BadgeTone = {
  card: "border-amber/50 bg-amber/10",
  box: "bg-amber/20 text-amber",
  lockedBox: "bg-amber/10 text-amber/45",
  text: "text-amber",
  chip: "bg-amber/15 text-amber",
};

/*
  Amber (#f59e0b) ile altın (#f5b301) yan yana ayırt edilemiyordu;
  bu yüzden 'Şehrin Sesi' kırmızıya alındı, amber yalnızca yedek
  palette kaldı.
*/
const RED: BadgeTone = {
  card: "border-status-danger/50 bg-status-danger/10",
  box: "bg-status-danger/20 text-status-danger",
  lockedBox: "bg-status-danger/10 text-status-danger/45",
  text: "text-status-danger",
  chip: "bg-status-danger/15 text-status-danger",
};

const GOLD: BadgeTone = {
  card: "border-coin/50 bg-coin/10",
  box: "bg-coin/20 text-coin",
  lockedBox: "bg-coin/10 text-coin/45",
  text: "text-coin",
  chip: "bg-coin/15 text-coin",
};

/*
  Ödül kilometre taşları rozet değil; altın tonunda kalıyorlar ki
  Seviye Yolu'nda rozetten ayrılsınlar.
*/
export const REWARD_TONE: BadgeTone = GOLD;

/** Slug'ı bilinen rozetlerin anlamla seçilmiş tonları. */
const BY_SLUG: Record<string, BadgeTone> = {
  "first-step": CYAN,
  "green-hero": GREEN,
  "culture-explorer": INDIGO,
  "social-starter": MAGENTA,
  "knowledge-seeker": VIOLET,
  "city-voice": RED,
  "city-maker": GOLD,
};

/*
  Yedek paleti: panelden sonradan eklenen rozetler de kendi rengini alsın.
  Denenen ve elenen alternatif: tanınmayan rozeti tek bir varsayılan renge
  düşürmek. Elendi, çünkü yeni rozetler çoğaldıkça ızgara yine tek renge
  dönüyordu. Hash slug'a bağlı, yani renk her yüklemede aynı kalıyor.
*/
const FALLBACK = [VIOLET, CYAN, MAGENTA, AMBER, GREEN, INDIGO, RED, GOLD];

export function badgeTone(slug: string): BadgeTone {
  const known = BY_SLUG[slug];
  if (known) {
    return known;
  }

  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return FALLBACK[hash % FALLBACK.length];
}
