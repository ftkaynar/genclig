import { createClient } from "@/lib/supabase/server";

export type DiscoverTask = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  xp: number;
  coin: number;
  categorySlug: string | null;
  categoryName: string | null;
};

/**
 * Haritada gösterilecek görevler: koordinatı olan aktif görevler.
 * Süresi dolmuş anlık görevler eleniyor, feed ile aynı kural.
 */
export async function listDiscoverTasks(): Promise<DiscoverTask[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("tasks")
    .select("id,title,lat,lng,xp,coin,ends_at,task_categories(slug,name)")
    .eq("status", "active")
    .not("lat", "is", null)
    .not("lng", "is", null)
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
    .limit(200);

  const rows = (data ?? []) as unknown as {
    id: string;
    title: string;
    lat: number;
    lng: number;
    xp: number;
    coin: number;
    task_categories: { slug: string; name: string } | null;
  }[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    lat: row.lat,
    lng: row.lng,
    xp: row.xp,
    coin: row.coin,
    categorySlug: row.task_categories?.slug ?? null,
    categoryName: row.task_categories?.name ?? null,
  }));
}

export type DistrictStats = {
  district_name: string;
  active_tasks: number;
  weekly_completed: number;
  channel_id: string | null;
};

/**
 * Keşfet'teki "İlçende" kartı.
 *
 * security definer RPC: haftalık tamamlanan sayısı başka kullanıcıların
 * teslimlerini de kapsıyor ve RLS onları gizliyor. Fonksiyon yalnızca
 * toplu sayı döndürüyor. İlçesi olmayan kullanıcıda null döner.
 */
export async function getDistrictStats(): Promise<DistrictStats | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("district_discover_stats");
  const rows = (data ?? []) as DistrictStats[];
  return rows[0] ?? null;
}
