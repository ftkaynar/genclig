import { createClient } from "@/lib/supabase/server";
import { markMissing } from "@/lib/supabase/schema-guard";

export type LeaderboardRow = {
  rank: number;
  user_id: string;
  username: string;
  level: number;
  total_xp: number;
};

export type MyRank = {
  rank: number;
  total_xp: number;
  scope_size: number;
} | null;

export const SCOPES = [
  { key: "turkiye", label: "Türkiye" },
  { key: "il", label: "İl" },
  { key: "ilce", label: "İlçe" },
  { key: "mahalle", label: "Mahalle" },
  /*
    'arkadaslar' sıralama ekranından kaldırıldı (D28 FAZ L): arkadaş
    listesi çoğu kullanıcıda 0-2 kişi olduğu için sekme boş bir
    sıralama gösteriyordu. leaderboard_top içindeki kapsam DURUYOR —
    ana sayfadaki "Arkadaşlarında #N" kartı getMyRank("arkadaslar")
    ile besleniyor. Bu listeden çıkması ?kapsam=arkadaslar isteğinin
    varsayılana (Türkiye) düşmesini de sağlıyor.
  */
  // Takım kapsamı farklı bir satır şekli döndürüyor (kullanıcı değil takım);
  // sayfa bu anahtarda ayrı bir dala giriyor, leaderboard_top çağrılmıyor.
  { key: "takimlar", label: "Takımlar" },
] as const;

/*
  Dönemler.

  'Tümü' ARAYÜZDEN KALKTI (D32): tüm zamanların sıralaması ilk
  kullanıcıları kalıcı olarak öne koyuyor ve sonradan katılanın
  yakalaması imkânsız — liste donuyor.

  'Bu Yıl' YERİNE 'Bu Sezon' (D35 FAZ SZ / M34c). Takvim yılı
  uygulamada hiçbir şeye karşılık gelmiyordu: ekranın üstünde sezon
  etiketi duruyor, altındaki hapta "Bu Yıl" seçiliyordu ve hangisinin
  listeyi belirlediği anlaşılmıyordu. Sezon penceresi yöneticinin
  tanımladığı gerçek yarış aralığı; dönem de o.

  'all' DB'de duruyor; leaderboard_top ve leaderboard_teams hâlâ kabul
  ediyor ve yönetim tarafında toplam bakmak gerekebilir.

  Pencere sınırları Europe/Istanbul: sunucu UTC ve ay/hafta başında üç
  saat boyunca önceki dönemin sıralaması görünürdü.
*/
export const PERIODS = [
  { key: "week", label: "Bu Hafta" },
  { key: "month", label: "Bu Ay" },
  { key: "season", label: "Bu Sezon" },
] as const;

/*
  ?donem=year eski bağlantılarda kalmış olabilir (D32-D34 arası
  paylaşılan ya da yer imine eklenen her sıralama URL'i).

  DB artık 'year'ı REDDEDİYOR ('Geçersiz dönem.'), yani eşlemesiz
  bırakmak eski bir bağlantıyı boş listeye düşürürdü. Kavramsal olarak
  en yakın karşılık sezon: ikisi de "uzun dönem".
*/
export function normalizePeriod(donem: string | undefined): string {
  if (donem === "year") return "season";
  return PERIODS.some((item) => item.key === donem) ? (donem as string) : "week";
}

/*
  Sıralama security definer fonksiyonlardan geliyor: RLS kullanıcıya yalnızca
  kendi işlemlerini gösterdiği için normal sorguyla sıralama üretilemez.
  Fonksiyonlar yalnızca kullanıcı adı, seviye ve dönem XP'si döndürüyor.
*/
/*
  'season' dönemi M34c ile geldi (öncesinde aynı mekanizma 'year' için
  vardı; dönem değişti, sorun aynı kaldı).

  ÖLÇÜLEN SORUN: migration koşmamış bir veritabanında leaderboard_top
  yeni dönem için P0001 / 'Geçersiz dönem.' raise ediyor. Hata
  YUTULUYORDU (`const { data }`), yani sekme hatasız ama BOMBOŞ bir
  liste gösteriyordu — kullanıcı için "kimse yok" ile "sorgu kırık"
  ayırt edilemiyordu.

  Bu hata eksik-şema koduyla (42703/PGRST202) gelmiyor, uygulama
  seviyesinde raise ediliyor; bu yüzden ayrı bir kontrol var.

  Geri düşerken 'month' seçiliyor. 'all' denendi ve elendi: sezon hapı
  seçiliyken tüm zamanların listesini göstermek, ilk kullanıcıları
  kalıcı olarak zirvede tutan donmuş bir liste demekti. Ay, sezonun
  içindeki gerçek ve canlı bir pencere.
*/
const SEASON = "season";
const SEASON_FALLBACK = "month";

/** Dönem, veritabanınca reddedildi mi? */
function isInvalidPeriod(error: { message?: string | null } | null) {
  return Boolean(error?.message?.includes("Geçersiz dönem"));
}

export async function getLeaderboard(
  scope: string,
  period: string,
): Promise<LeaderboardRow[]> {
  const supabase = await createClient();

  const read = (p: string) =>
    supabase.rpc("leaderboard_top", {
      p_scope: scope,
      p_period: p,
      p_limit: 50,
    });

  let { data, error } = await read(period);

  if (error && period === SEASON && isInvalidPeriod(error)) {
    markMissing("period_start('season')");
    ({ data, error } = await read(SEASON_FALLBACK));
  }

  return (data ?? []) as LeaderboardRow[];
}

export async function getMyRank(scope: string, period: string): Promise<MyRank> {
  const supabase = await createClient();

  const read = (p: string) =>
    supabase.rpc("leaderboard_my_rank", {
      p_scope: scope,
      p_period: p,
    });

  let { data, error } = await read(period);

  // getLeaderboard ile aynı geri düşme: sıra ve liste ayrışmamalı.
  if (error && period === SEASON && isInvalidPeriod(error)) {
    ({ data, error } = await read(SEASON_FALLBACK));
  }

  const rows = (data ?? []) as NonNullable<MyRank>[];
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}
