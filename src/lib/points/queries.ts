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

/** Sayıları Türkçe biçimde yazar: 4230 -> "4.230". */
export function formatPoints(value: number): string {
  return new Intl.NumberFormat("tr-TR").format(value);
}
