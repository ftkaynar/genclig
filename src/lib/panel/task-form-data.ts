import { createClient } from "@/lib/supabase/server";
import {
  isKnownMissing,
  isMissingSchema,
  markMissing,
} from "@/lib/supabase/schema-guard";
import type { TaskFormValues } from "@/components/panel/task-form";
import { getTaskCategories } from "@/lib/reference/queries";

const ART_KEY = "tasks.art_key";
const ISSUER_KEY = "tasks.issuer_name";

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

/** M30 öncesi de var olan alanlar. */
const FORM_FIELDS_BASE =
  "id,title,description,instructions,type,category_id,verification,difficulty,scope,min_team_size,team_bonus_xp,team_bonus_coin,daily_submission_limit,icon,xp,coin,starts_at,ends_at,lat,lng,radius_m,capacity,image_url,status";

/**
 * Şemanın desteklediği en geniş alan listesi.
 *
 * Katmanlar ayrı: bulutta M30 uygulanmış ama M34a uygulanmamış olabiliyor.
 * Hepsini tek bayrağa bağlamak, issuer eksikken art_key'i de gereksiz
 * yere düşürmek demekti (aynı desen lib/tasks/queries.ts'te).
 */
function formFields(): string {
  const parts = [FORM_FIELDS_BASE];
  if (!isKnownMissing(ART_KEY)) parts.push("art_key");
  if (!isKnownMissing(ISSUER_KEY)) parts.push("issuer_name,location_label");
  return parts.join(",");
}

/** Eksik katmanı bir adım düşürür; düşürecek katman kalmadıysa false. */
function degradeFormFields(): boolean {
  if (!isKnownMissing(ISSUER_KEY)) {
    markMissing(ISSUER_KEY);
    return true;
  }
  if (!isKnownMissing(ART_KEY)) {
    markMissing(ART_KEY);
    return true;
  }
  return false;
}

/**
 * Düzenleme formunun okuduğu satır.
 *
 * `art_key` isteğe bağlı: M30 koşmamış bir veritabanında alan listesinden
 * düşürülüyor ve satırda hiç bulunmuyor.
 */
type TaskEditRow = {
  id: string;
  title: string | null;
  description: string | null;
  instructions: string | null;
  type: string | null;
  category_id: number | null;
  verification: string | null;
  difficulty: string | null;
  scope: string | null;
  min_team_size: number | null;
  team_bonus_xp: number | null;
  team_bonus_coin: number | null;
  daily_submission_limit: number | null;
  icon: string | null;
  xp: number | null;
  coin: number | null;
  starts_at: string | null;
  ends_at: string | null;
  lat: number | null;
  lng: number | null;
  radius_m: number | null;
  capacity: number | null;
  image_url: string | null;
  status: string | null;
  art_key?: string | null;
  issuer_name?: string | null;
  location_label?: string | null;
};

/** Var olan görevi form değerlerine çevirir. */
export async function loadTaskForEdit(
  id: string,
): Promise<TaskFormValues | null> {
  const supabase = await createClient();

  /*
    Alan listesi çalışma anında kurulduğu için PostgREST'in tip çıkarımı
    devre dışı kalıyor; satır bu yüzden açıkça yazıldı. Gevşek bir
    `any` denendi ve elendi — aşağıdaki otuz alanın adı sessizce yanlış
    yazılabilir hale geliyordu.
  */
  const read = (fields: string) =>
    supabase
      .from("tasks")
      .select(fields)
      .eq("id", id)
      .maybeSingle<TaskEditRow>();

  let { data, error } = await read(formFields());

  /*
    art_key M30 ile geldi; sütun yoksa onsuz bir kez daha okunuyor.
    Hata eskiden YUTULUYORDU (`const { data }`) ve migration koşmamış bir
    veritabanında düzenleme formu hep boş açılıyordu.
  */
  while (error && isMissingSchema(error) && degradeFormFields()) {
    ({ data, error } = await read(formFields()));
  }

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
    dailySubmissionLimit:
      data.daily_submission_limit !== null
        ? String(data.daily_submission_limit)
        : "3",
    minTeamSize: data.min_team_size !== null ? String(data.min_team_size) : "2",
    teamBonusXp: String(data.team_bonus_xp ?? 0),
    teamBonusCoin: String(data.team_bonus_coin ?? 0),
    icon: data.icon ?? "list-checks",
    // Sütun yoksa alan formda boş kalıyor; seçici de kaydetmeyecek.
    artKey: ("art_key" in data ? data.art_key : null) ?? "",
    issuerName: data.issuer_name ?? "",
    locationLabel: data.location_label ?? "",
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
