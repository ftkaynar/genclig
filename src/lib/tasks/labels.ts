/** Görev alanlarının kullanıcıya görünen Türkçe karşılıkları ve süre biçimi. */

export const TASK_TYPE_LABEL: Record<string, string> = {
  continuous: "Sürekli",
  instant: "Anlık",
  daily: "Günlük",
  weekly: "Haftalık",
  monthly: "Aylık",
};

export const VERIFICATION_LABEL: Record<string, string> = {
  photo: "Fotoğraf",
  gps: "Konum",
  photo_gps: "Fotoğraf + Konum",
  qr: "QR kod",
  quiz: "Test",
  health: "Sağlık verisi",
  manual: "Elle onay",
};

export const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Kolay",
  medium: "Orta",
  hard: "Zor",
};

export const SUBMISSION_STATUS_LABEL: Record<string, string> = {
  pending: "İncelemede",
  approved: "Tamamlandı",
  rejected: "Reddedildi",
};

/**
 * Kategoriye göre kapak bloğunun gradyan tonu.
 * Sınıf adları tam metin olarak yazılı: Tailwind kaynağı tarayarak sınıf
 * üretiyor, `from-${slug}` gibi kurulmuş bir ad derlemeye hiç girmez.
 */
export const CATEGORY_TONE: Record<string, string> = {
  environment: "from-status-success to-cyan",
  social: "from-primary to-indigo",
  sports: "from-magenta to-primary",
  culture: "from-indigo to-primary",
  education: "from-coin to-magenta",
  civic: "from-cyan to-indigo",
};

export const CATEGORY_TONE_FALLBACK = "from-indigo to-primary";

/**
 * Kalan süreyi kullanıcı diliyle yazar.
 *
 * Kademeler bilerek iki birimle sınırlı: "6g 23s 14d 08sn" okunmuyor, karar
 * vermeye de yaramıyor. Gün varken dakika, saat varken saniye gösterilmiyor.
 */
export function formatRemaining(msLeft: number): string {
  if (msLeft <= 0) {
    return "Süre doldu";
  }

  const totalMinutes = Math.floor(msLeft / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.floor((msLeft % 60_000) / 1000);

  if (days > 0) {
    return `Kalan ${days}g ${hours}s`;
  }
  if (hours > 0) {
    return `Kalan ${hours}s ${minutes}d`;
  }
  if (minutes > 0) {
    return `Kalan ${minutes}d`;
  }
  return `Kalan ${seconds}sn`;
}

/**
 * Bir sonraki güncellemeye kaç ms kaldığı.
 * Son dakikada saniyede, öncesinde dakikada yenilenir; dakikalık bir sayacı
 * saniyede bir yeniden çizmek boşa render.
 */
export function nextTickDelay(msLeft: number): number | null {
  if (msLeft <= 0) {
    return null;
  }
  return msLeft < 60_000 ? 1000 : 60_000;
}
