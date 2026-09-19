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
  /** Kazanılma tarihi yazısı. */
  text: string;
  /** Seviye Yolu'ndaki kilometre taşı hapı. */
  chip: string;
  /*
    Madalyanın ham rengi (D36 FAZ RZ).

    Tailwind sınıfı YETMİYOR: madalya metal halkası, iç disk ve ikon
    için `color-mix` ile türetilmiş üç ayrı ton gerekiyor ve bunlar
    CSS'te hesaplanıyor — bir sınıf adıyla gradyan kurulamıyor. Değer
    CSS değişkeni olarak (--medal) geçiyor ve türevleri orada çıkıyor.
  */
  hex: string;
};

const CYAN: BadgeTone = {
  card: "border-cyan/50 bg-cyan/10",
  text: "text-cyan",
  chip: "bg-cyan/15 text-cyan",
  hex: "#22d3ee",
};

const GREEN: BadgeTone = {
  card: "border-status-success/50 bg-status-success/10",
  text: "text-status-success",
  chip: "bg-status-success/15 text-status-success",
  hex: "#22c55e",
};

const INDIGO: BadgeTone = {
  card: "border-indigo/50 bg-indigo/10",
  text: "text-indigo",
  chip: "bg-indigo/15 text-indigo",
  hex: "#6366f1",
};

const MAGENTA: BadgeTone = {
  card: "border-magenta/50 bg-magenta/10",
  text: "text-magenta",
  chip: "bg-magenta/15 text-magenta",
  hex: "#ec4899",
};

const VIOLET: BadgeTone = {
  card: "border-primary/50 bg-primary/10",
  text: "text-primary",
  chip: "bg-primary/15 text-primary",
  hex: "#7c3aed",
};

const AMBER: BadgeTone = {
  card: "border-amber/50 bg-amber/10",
  text: "text-amber",
  chip: "bg-amber/15 text-amber",
  hex: "#f59e0b",
};

/*
  Amber (#f59e0b) ile altın (#f5b301) yan yana ayırt edilemiyordu;
  bu yüzden 'Şehrin Sesi' kırmızıya alındı, amber yalnızca yedek
  palette kaldı.
*/
const RED: BadgeTone = {
  card: "border-status-danger/50 bg-status-danger/10",
  text: "text-status-danger",
  chip: "bg-status-danger/15 text-status-danger",
  hex: "#ef4444",
};

const GOLD: BadgeTone = {
  card: "border-coin/50 bg-coin/10",
  text: "text-coin",
  chip: "bg-coin/15 text-coin",
  hex: "#f5b301",
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
