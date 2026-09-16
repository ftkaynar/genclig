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
  yakalaması imkânsız — liste donuyor. Yıl penceresi her ocakta
  sıfırlanıyor, yarış canlı kalıyor.

  'all' DB'de duruyor; leaderboard_top ve leaderboard_teams hâlâ kabul
  ediyor ve yönetim tarafında toplam bakmak gerekebilir.

  Yıl sınırı Europe/Istanbul: sunucu UTC ve 1 Ocak'ta üç saat boyunca
  önceki yılın sıralaması görünürdü.
*/
export const PERIODS = [
  { key: "week", label: "Bu Hafta" },
  { key: "month", label: "Bu Ay" },
  { key: "year", label: "Bu Yıl" },
] as const;

/*
  Sıralama security definer fonksiyonlardan geliyor: RLS kullanıcıya yalnızca
  kendi işlemlerini gösterdiği için normal sorguyla sıralama üretilemez.
  Fonksiyonlar yalnızca kullanıcı adı, seviye ve dönem XP'si döndürüyor.
*/
/*
  'year' dönemi M30 ile geldi.

  ÖLÇÜLEN SORUN: migration koşmamış bir veritabanında leaderboard_top
  'year' için P0001 / 'Geçersiz dönem.' raise ediyor. Hata
  YUTULUYORDU (`const { data }`), yani "Bu Yıl" sekmesi hatasız ama
  BOMBOŞ bir liste gösteriyordu — kullanıcı için "kimse yok" ile
  "sorgu kırık" ayırt edilemiyordu.

  Bu hata eksik-şema koduyla (42703/PGRST202) gelmiyor, uygulama
  seviyesinde raise ediliyor; bu yüzden ayrı bir kontrol var.

  Geri düşerken 'all' seçiliyor: yıl penceresi yokken tüm zamanlar,
  boş listeden çok daha yakın bir yaklaşım.
*/
const YEAR = "year";
const YEAR_FALLBACK = "all";

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

  if (error && period === YEAR && isInvalidPeriod(error)) {
    markMissing("period_start('year')");
    ({ data, error } = await read(YEAR_FALLBACK));
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
  if (error && period === YEAR && isInvalidPeriod(error)) {
    ({ data, error } = await read(YEAR_FALLBACK));
  }

  const rows = (data ?? []) as NonNullable<MyRank>[];
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}
