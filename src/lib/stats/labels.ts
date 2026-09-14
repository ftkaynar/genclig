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
};

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

