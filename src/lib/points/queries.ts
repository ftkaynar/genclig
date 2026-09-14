import { createClient } from "@/lib/supabase/server";

/*
  Bakiye ve seviye okuma.

  Hiçbiri saklanan değer değil: XP ve Coin işlem satırlarının toplamı,
  seviye de XP'den levels tablosuna bakılarak hesaplanıyor. Bu yüzden burada
  yalnızca okuma var; puanı değiştiren tek yol sunucudaki security definer
  fonksiyonlar.
*/

export type UserPoints = {
  xp: number;
  coin: number;
  level: number;
  levelMinXp: number;
  /** Son seviyede null: yukarısı yok. */
  nextLevelXp: number | null;
  /** 0-1 arası; son seviyede 1. */
  progress: number;
};

export async function getUserPoints(userId: string): Promise<UserPoints> {
  const supabase = await createClient();

  /*
    Bakiye görünümleri security_invoker ile çalışıyor, yani RLS altında
    kullanıcı yalnızca kendi satırını görüyor. Hiç işlemi olmayan kullanıcı
    için satır dönmüyor; bu bir hata değil, sıfır bakiye demek.
  */
  const [{ data: xpRow }, { data: coinRow }] = await Promise.all([
    supabase
      .from("user_xp_balance")
      .select("total_xp")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("user_coin_balance")
      .select("total_coin")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const xp = xpRow?.total_xp ?? 0;
  const coin = coinRow?.total_coin ?? 0;

  const { data: levelRows } = await supabase.rpc("level_from_xp", {
    p_xp: xp,
  });

  const level = Array.isArray(levelRows) ? levelRows[0] : levelRows;

  return {
    xp,
    coin,
    level: level?.level ?? 1,
    levelMinXp: level?.level_min_xp ?? 0,
    nextLevelXp: level?.next_level_xp ?? null,
    progress: Number(level?.progress ?? 0),
  };
}

/**
 * Bugün kazanılan XP ve Coin.
 *
 * Gün sınırı Europe/Istanbul'a göre: sunucu UTC çalışıyor ve gece yarısından
 * sonraki kazanç dünün toplamına düşüyordu.
 */
export async function getTodayEarnings(
  userId: string,
): Promise<{ xp: number; coin: number }> {
  const supabase = await createClient();

  /*
    Yerel günün başlangıcı, UTC damgası olarak.

    Türkiye 2016'dan beri sabit UTC+03:00 kullanıyor (yaz saati uygulaması
    kaldırıldı), bu yüzden ofset doğrudan yazılabiliyor. Tarih kısmı yine de
    Intl üzerinden alınıyor: sunucunun kendi saat dilimi ne olursa olsun
    "İstanbul'da bugün hangi gün" sorusunun cevabı değişmemeli.
  */
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const since = new Date(`${today}T00:00:00+03:00`).toISOString();

  const [{ data: xpRows }, { data: coinRows }] = await Promise.all([
    supabase
      .from("xp_transactions")
      .select("amount")
      .eq("user_id", userId)
      .gte("created_at", since),
    supabase
      .from("coin_transactions")
      .select("amount")
      .eq("user_id", userId)
      .gte("created_at", since),
  ]);

  const sum = (rows: { amount: number }[] | null) =>
    (rows ?? []).reduce((total, row) => total + row.amount, 0);

  return { xp: sum(xpRows), coin: sum(coinRows) };
}

/** Sayıları Türkçe biçimde yazar: 4230 -> "4.230". */
export function formatPoints(value: number): string {
  return new Intl.NumberFormat("tr-TR").format(value);
}
