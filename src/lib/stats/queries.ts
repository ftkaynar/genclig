import type { UserStats } from "@/lib/stats/labels";
import { createClient } from "@/lib/supabase/server";

/*
  Kendi istatların. `my_stats` hiç hesaplanmamışsa ilk okumada üretiyor,
  bu yüzden kart her zaman dolu geliyor.

  Başkasının istatları RLS üzerinden okunuyor: yalnızca arkadaşlar ve
  süper admin görebiliyor (user_stats politikaları).
*/
export async function getMyStats(): Promise<UserStats | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_stats");
  const row = (Array.isArray(data) ? data[0] : data) as UserStats | null;
  return row?.user_id ? row : null;
}

/*
  Başkasının istatları.

  Tabloyu doğrudan okumak yerine `stats_for` RPC'si: tablodaki değerler
  TABAN (decay'siz) ve doğrudan okuma soğumayı atlardı. RPC security
  invoker — görünürlük sınırı hâlâ user_stats RLS politikalarında.
*/
export async function getStatsFor(userId: string): Promise<UserStats | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("stats_for", { p_user: userId });
  const row = (Array.isArray(data) ? data[0] : data) as UserStats | null;
  return row?.user_id ? row : null;
}
