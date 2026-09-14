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

export async function getStatsFor(userId: string): Promise<UserStats | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_stats")
    .select("user_id,akt,sos,kat,kes,bil,azm,ovr,tier,computed_at")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as UserStats) ?? null;
}
