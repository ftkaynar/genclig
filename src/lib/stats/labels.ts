/*
  Kimlik kartı istatları.

  Saf veri ayrı dosyada: client bileşenleri import ediyor ve `queries.ts`
  içinde dururken next/headers tarayıcı paketine sızıyor (D21-D23'te
  ölçülmüştü).
*/

export type UserStats = {
  user_id: string;
  akt: number;
  sos: number;
  kat: number;
  kes: number;
  bil: number;
  azm: number;
  ovr: number;
  tier: "bronze" | "silver" | "gold" | "special";
  computed_at: string;
  /**
   * Son gerçek eylem (onaylı teslim / bildirim / mesaj / arkadaşlık).
   * Decay bu tarihe dayanıyor; kart “soğuyor” rozetini buradan
   * karar veriyor. Hiç eylem yoksa null.
   */
  last_activity_at: string | null;
};

/*
  Decay eşikleri — M27'deki SQL sabitleriyle AYNI olmak zorunda.

  İki yerde durmasının sebebi: değerleri SQL hesaplıyor, arayüz
  yalnızca “soğuyor mu” rozetini gösteriyor. Rozeti sunucudan ayrı bir
  alan olarak döndürmek, her kart okumasına bir kolon daha eklerdi;
  buradaki tek sayı kopyası daha ucuz. Değişirse ikisi birden.
*/
export const DECAY_GRACE_DAYS = 7;
export const DECAY_WARN_DAYS = 5;

/** Kaç gündür eylemsiz? Hiç eylem yoksa null. */
export function inactiveDays(lastActivityAt: string | null): number | null {
  if (!lastActivityAt) {
    return null;
  }
  const ms = Date.now() - new Date(lastActivityAt).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * Altı istatın adı, uzun karşılığı ve "nasıl artar" ipucu.
 *
 * İpuçları kartın arka yüzünde gösteriliyor: bir sayının neden düşük
 * olduğunu bilmeyen kullanıcı onu yükseltmeye de çalışmıyor.
 */
export const STAT_META = [
  {
    key: "akt" as const,
    short: "AKT",
    name: "Aktiflik",
    hint: "Görev tamamla ve arka arkaya günlerde aktif ol.",
  },
  {
    key: "sos" as const,
    short: "SOS",
    name: "Sosyallik",
    hint: "Arkadaş ekle, takıma katıl, sosyal görevler yap.",
  },
  {
    key: "kat" as const,
    short: "KAT",
    name: "Katkı",
    hint: "Şehrindeki sorunları bildir; çözülenler daha çok sayılır.",
  },
  {
    key: "kes" as const,
    short: "KEŞ",
    name: "Keşif",
    hint: "Farklı konumlarda ve farklı kategorilerde görev yap.",
  },
  {
    key: "bil" as const,
    short: "BİL",
    name: "Bilgi",
    hint: "Test görevlerini geç, eğitim ve kültür görevleri yap.",
  },
  {
    key: "azm" as const,
    short: "AZM",
    name: "Azim",
    hint: "Zor görevleri seç ve düzenli olarak devam et.",
  },
];

export const TIER_LABEL: Record<string, string> = {
  bronze: "Bronz",
  silver: "Gümüş",
  gold: "Altın",
  special: "Özel",
};

