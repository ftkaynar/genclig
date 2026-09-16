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

/**
 * Görevin zaman durumu.
 *
 * Üç durum: henüz başlamamış, açık, bitmiş. Kart ve detay bu değere göre
 * renk, ikon ve geri sayım yönü seçiyor.
 *
 * Neden sorgu katmanında hesaplanıyor: `Date.now()` render içinde
 * çağrılınca bileşen saf olmaktan çıkıyor ve lint hata veriyor (D07 ve
 * D23'te aynı kurala takılmıştık).
 */
export type TaskTimeState = "upcoming" | "active" | "ended";

export function taskTimeState(
  startsAt: string | null,
  endsAt: string | null,
  now: number,
): TaskTimeState {
  if (startsAt && new Date(startsAt).getTime() > now) return "upcoming";
  if (endsAt && new Date(endsAt).getTime() < now) return "ended";
  return "active";
}

/*
  Zaman durumunun görsel dili.

  Her durum ikon + renkle ayrışıyor; renk tek başına ayırt edici değil
  (renk körlüğü) ve "yaklaşan" ile "bitmek üzere" karıştırıldığında
  kullanıcı görevi kaçırıyor.
*/
export const TIME_STATE_STYLE: Record<
  string,
  { icon: string; chip: string; label: string }
> = {
  upcoming: {
    icon: "calendar-clock",
    chip: "bg-gradient-to-r from-indigo/20 to-primary/20 text-indigo",
    label: "Yakında",
  },
  instant: {
    icon: "zap",
    chip: "bg-gradient-to-r from-amber/20 to-magenta/20 text-amber",
    label: "Anlık",
  },
  continuous: {
    icon: "activity",
    chip: "bg-xp/15 text-xp",
    label: "Sürekli",
  },
  ended: {
    icon: "timer",
    chip: "bg-surface text-ink-muted",
    label: "Bitti",
  },
};

/** Başlangıca kalan süreyi kullanıcı diliyle yazar. */
export function formatStartsIn(msLeft: number): string {
  if (msLeft <= 0) return "Başladı";

  const totalMinutes = Math.floor(msLeft / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `Başlıyor: ${days}g ${hours}s`;
  if (hours > 0) return `Başlıyor: ${hours}s ${minutes}d`;
  return `Başlıyor: ${minutes}d`;
}

/** Tam tarih-saat, Türkiye biçiminde. */
export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ---------------------------------------------------------------------------
   Görev kartının durum ritmi (D32 FAZ G3)

   ÖNCEKİ DURUM: kart sağ üstünde "Tamamlandı" yazan bir kurdele vardı.
   İki sorunu vardı:

   1. Metin küçüktü ve kartın en az bakılan köşesindeydi — tamamlama
      duygusu (oyunda en değerli an) bir etikete sıkışmıştı.
   2. Sürekli görevde tik SONSUZA KADAR kalıyordu. Kullanıcı bir kez
      yürüyüş yapınca kart ömür boyu "Tamamlandı" diyordu; günlük ritim
      diye bir şey kalmıyordu ve ertesi gün geri gelmek için sebep yoktu.

   v3'te dört durum var ve her biri İKONLA ayrışıyor (renk tek başına
   ayırt edici değil — renk körlüğü):

     done    büyük tik      yeşil     bu gün tamamlandı
     pending saat           turuncu   incelemede
     repeat  alev           turuncu   sürekli görev, gün yenilendi
     none    —                        henüz dokunulmadı

   `repeat` yalnız SÜREKLİ görevde var: dönemli görevlerde (günlük,
   haftalık) tekillik kontrolü zaten period_key üzerinden sunucuda
   yapılıyor, orada "tekrar yap" demek çalışmayan bir davet olurdu.
   --------------------------------------------------------------------------- */

export type TaskCardState = "done" | "pending" | "repeat" | "none";

export const TASK_STATE_STYLE: Record<
  Exclude<TaskCardState, "none">,
  { icon: string; label: string; ring: string; badge: string }
> = {
  done: {
    icon: "check",
    label: "Tamamlandı",
    ring: "ring-status-success/60",
    badge: "bg-status-success",
  },
  pending: {
    icon: "timer",
    label: "İncelemede",
    ring: "ring-status-warning/60",
    badge: "bg-status-warning",
  },
  repeat: {
    icon: "flame",
    label: "Tekrar yap",
    ring: "ring-amber/60",
    badge: "bg-amber",
  },
};

/**
 * Kartın hangi durumu göstereceği.
 *
 * `isToday` teslimin İÇİNDE BULUNULAN görev gününe (Europe/Istanbul
 * 06:00) ait olup olmadığını söylüyor; sorgu katmanında hesaplanıyor
 * çünkü render içinde `Date.now()` çağırmak bileşeni saf olmaktan
 * çıkarıyor.
 */
export function taskCardState(
  taskType: string,
  submission: { status: string; isToday: boolean } | undefined,
): TaskCardState {
  if (!submission) return "none";

  const isContinuous = taskType === "continuous";

  if (submission.status === "pending") {
    // Bekleyen teslim eskise bile "incelemede": karar hâlâ verilmedi.
    return "pending";
  }

  if (submission.status === "approved") {
    if (isContinuous && !submission.isToday) return "repeat";
    return "done";
  }

  // Reddedilen teslim kartı kilitlemiyor — kullanıcı yeniden deneyebilmeli.
  return isContinuous ? "repeat" : "none";
}
