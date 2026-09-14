import { createClient } from "@/lib/supabase/server";
import type { TaskFormValues } from "@/components/panel/task-form";
import { getTaskCategories } from "@/lib/reference/queries";

/** Form için kategori listesi. */
export async function listTaskCategories(): Promise<
  { id: number; name: string }[]
> {
  // Kategoriler referans önbelleğinden; her form açılışında sorgu yok.
  return (await getTaskCategories()).map((row) => ({
    id: row.id,
    name: row.name,
  }));
}

/** datetime-local alanının beklediği "YYYY-MM-DDTHH:mm" biçimi. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Var olan görevi form değerlerine çevirir. */
export async function loadTaskForEdit(
  id: string,
): Promise<TaskFormValues | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("tasks")
    .select(
      "id,title,description,instructions,type,category_id,verification,difficulty,scope,min_team_size,team_bonus_xp,team_bonus_coin,icon,xp,coin,starts_at,ends_at,lat,lng,radius_m,capacity,image_url,status",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    title: data.title ?? "",
    description: data.description ?? "",
    instructions: data.instructions ?? "",
    type: data.type ?? "continuous",
    categoryId: data.category_id ? String(data.category_id) : "",
    verification: data.verification ?? "photo",
    difficulty: data.difficulty ?? "easy",
    taskScope: data.scope ?? "individual",
    minTeamSize: data.min_team_size !== null ? String(data.min_team_size) : "2",
    teamBonusXp: String(data.team_bonus_xp ?? 0),
    teamBonusCoin: String(data.team_bonus_coin ?? 0),
    icon: data.icon ?? "list-checks",
    xp: String(data.xp ?? 0),
    coin: String(data.coin ?? 0),
    startsAt: toLocalInput(data.starts_at),
    endsAt: toLocalInput(data.ends_at),
    lat: data.lat !== null ? String(data.lat) : "",
    lng: data.lng !== null ? String(data.lng) : "",
    radiusM: data.radius_m !== null ? String(data.radius_m) : "150",
    capacity: data.capacity !== null ? String(data.capacity) : "",
    imageUrl: data.image_url ?? "",
    status: data.status ?? "draft",
  };
}

/**
 * Düzenleme formu için quiz soruları — doğru şık DAHİL.
 *
 * Kullanıcı tarafındaki `get_task_quiz` bilerek anahtarı gizliyor; burada
 * soruyu yazan personel düzenleyecek, doğru şıkkı görmesi gerekiyor.
 * Erişim RLS ile sınırlı: ham tabloyu yalnızca süper admin ve görevin
 * belediyesindeki personel okuyabiliyor.
 */
export async function loadQuizForEdit(taskId: string): Promise<
  {
    question: string;
    options: { key: string; text: string }[];
    correctKey: string;
  }[]
> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("task_quiz_questions")
    .select("question,options,correct_key,sort")
    .eq("task_id", taskId)
    .order("sort");

  return (data ?? []).map((row) => ({
    question: row.question as string,
    options: row.options as { key: string; text: string }[],
    correctKey: row.correct_key as string,
  }));
}
