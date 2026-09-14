import { createClient } from "@/lib/supabase/server";
import { formatRemaining } from "@/lib/tasks/labels";

/*
  Görev sorguları. Tamamı sunucuda çalışır.

  RLS zaten yayında olmayan görevi gizliyor, ama status = 'active' filtresi
  sorguda da açıkça yazılı. Neden iki kere: politika ileride personel için
  genişletilirse (kendi belediyesinin taslakları gibi) kullanıcı feed'i
  sessizce taslak göstermeye başlardı. Filtre sorguda durursa feed'in ne
  gösterdiği politikadan bağımsız kalıyor.
*/

/** Kullanıcı arayüzünde gösterilen görev tipleri. */
export const FEED_TASK_TYPES = ["continuous", "instant"] as const;

export type TaskCategory = {
  slug: string;
  name: string;
  icon: string | null;
};

export type TaskRow = {
  id: string;
  type: string;
  title: string;
  description: string;
  instructions: string | null;
  image_url: string | null;
  xp: number;
  coin: number;
  difficulty: string;
  verification: string;
  scope: string;
  min_team_size: number | null;
  team_bonus_xp: number;
  team_bonus_coin: number;
  lat: number | null;
  lng: number | null;
  radius_m: number | null;
  ends_at: string | null;
  capacity: number | null;
  icon: string | null;
  task_categories: TaskCategory | null;
  /**
   * Geri sayımın sunucuda hesaplanmış ilk metni.
   *
   * Neden burada: React bileşeni içinde Date.now() çağırmak render'ı saf
   * olmaktan çıkarıyor ve lint bunu hata sayıyor. Değer sorgu katmanında
   * üretilince bileşen yalnızca hazır metni basıyor, geri sayım ilk
   * güncellemeye kadar sunucunun gördüğü zamanı gösteriyor.
   */
  remainingLabel: string | null;
};

const TASK_FIELDS =
  "id,type,title,description,instructions,image_url,icon,xp,coin,difficulty,verification,scope,min_team_size,team_bonus_xp,team_bonus_coin,lat,lng,radius_m,ends_at,capacity,task_categories(slug,name,icon)";

function withRemainingLabel(rows: unknown[]): TaskRow[] {
  const now = Date.now();
  return (rows as TaskRow[]).map((row) => ({
    ...row,
    remainingLabel: row.ends_at
      ? formatRemaining(new Date(row.ends_at).getTime() - now)
      : null,
  }));
}

/**
 * Feed'deki görevler.
 * Süresi dolmuş anlık görevler listeden düşer; bu filtre veritabanında
 * yapılıyor, çünkü sayfalama eklendiğinde istemcide elemek sayfa başına
 * düşen kayıt sayısını öngörülemez hale getirir.
 */
export const FEED_TASK_SCOPES = ["individual", "team"] as const;

export async function listFeedTasks(
  type?: string,
  scope?: string,
): Promise<TaskRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select(TASK_FIELDS)
    .eq("status", "active")
    .in("type", [...FEED_TASK_TYPES])
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: true });

  if (type && (FEED_TASK_TYPES as readonly string[]).includes(type)) {
    query = query.eq("type", type);
  }

  // Bireysel/Takım ayrımı da veritabanında: tip filtresiyle aynı gerekçe.
  if (scope && (FEED_TASK_SCOPES as readonly string[]).includes(scope)) {
    query = query.eq("scope", scope);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Görevler alınamadı: ${error.message}`);
  }

  return withRemainingLabel(data ?? []);
}

/** Tek görev. Bulunamazsa null; RLS gizlediğinde de aynı sonucu verir. */
export async function getTask(id: string): Promise<TaskRow | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("tasks")
    .select(TASK_FIELDS)
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();

  return data ? (withRemainingLabel([data])[0] ?? null) : null;
}

export type SubmissionSummary = {
  status: string;
};

/**
 * Kullanıcının verilen görevlerdeki teslim durumları.
 * Anahtar task_id. Oturum yoksa boş harita döner.
 *
 * Dönem ayrımı yapılmıyor çünkü feed yalnızca continuous ve instant
 * gösteriyor; ikisinde de period_key her zaman 'once'. Feed'e dönemli tipler
 * eklenirse bu fonksiyon period_key'e göre süzmek zorunda kalacak.
 */
export async function getSubmissionMap(
  taskIds: string[],
): Promise<Map<string, SubmissionSummary>> {
  const result = new Map<string, SubmissionSummary>();
  if (taskIds.length === 0) {
    return result;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return result;
  }

  const { data } = await supabase
    .from("task_submissions")
    .select("task_id,status")
    .eq("user_id", user.id)
    .in("task_id", taskIds);

  for (const row of data ?? []) {
    result.set(row.task_id, { status: row.status });
  }

  return result;
}

/**
 * Kaç kişi katıldı: beklemede + onaylanmış teslimler.
 *
 * Doğrudan sayım yapılamıyor: RLS kullanıcıya yalnızca kendi teslimlerini
 * gösterdiği için task_submissions üzerinde alınan her sayım en fazla 1
 * döner (ölçüldü: gerçek 2 iken görünen 1). Sayıyı security definer
 * task_participant_count fonksiyonu veriyor; o yalnızca bir tam sayı
 * döndürüyor, kimlerin katıldığını sızdırmıyor.
 */
export async function getParticipantCount(taskId: string): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("task_participant_count", {
    p_task_id: taskId,
  });

  if (error) {
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

export async function getViewer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
