import { createClient } from "@/lib/supabase/server";
import type { ReviewItem } from "@/components/panel/review-queue";

/*
  Panel sorguları. RLS zaten personeli kendi belediyesiyle sınırlıyor; buradaki
  filtreler niyeti açık bırakmak ve indeksleri kullandırmak için.
*/

/**
 * Bekleyen teslimler.
 *
 * `scope` üç değer alıyor:
 * - bir belediye kimliği → yalnızca o belediyenin görevleri (panel),
 * - `"all"` → TÜM belediyeler + global görevler (süper admin),
 * - `null` → yalnızca global görevler.
 *
 * ÖLÇÜLEN HATA (D24 FAZ T): süper admin ekranı `null` çağırıyordu, yani
 * yalnızca `municipality_id is null` olan global görevlerin teslimlerini
 * listeliyordu. Bir belediye görevine gönderilen fotoğraf süper adminin
 * kuyruğunda hiç görünmüyordu; oysa `review_submission` süper admini zaten
 * tüm görevler için yetkilendiriyor ve `task_submissions_select_super`
 * politikası satırları gösteriyor. Eksik olan tek şey listeleme
 * filtresiydi.
 *
 * Fotoğraflar için imzalı URL üretiliyor; bucket private.
 */
export async function listPendingReviews(
  scope: string | null | "all",
): Promise<ReviewItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("task_submissions")
    .select(
      "id,created_at,photo_path,distance_m,user_id,tasks!inner(title,municipality_id,municipalities(name)),profiles(username)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);

  if (scope === null) {
    query = query.is("tasks.municipality_id", null);
  } else if (scope !== "all") {
    query = query.eq("tasks.municipality_id", scope);
  }
  // "all": filtre yok — RLS zaten yalnızca yetkili olduğu satırları veriyor.

  const { data } = await query;

  const rows = (data ?? []) as unknown as {
    id: string;
    created_at: string;
    photo_path: string | null;
    distance_m: number | null;
    tasks: {
      title: string;
      municipalities: { name: string } | null;
    } | null;
    profiles: { username: string | null } | null;
  }[];

  return Promise.all(
    rows.map(async (row) => {
      let photoUrl: string | null = null;

      if (row.photo_path) {
        const { data: signed } = await supabase.storage
          .from("task-proofs")
          .createSignedUrl(row.photo_path, 60 * 30);
        photoUrl = signed?.signedUrl ?? null;
      }

      return {
        id: row.id,
        taskTitle: row.tasks?.title ?? "Görev",
        // Global görevde belediye yok; ekranda "Genel" yazıyor.
        municipalityName: row.tasks?.municipalities?.name ?? null,
        username: row.profiles?.username ?? null,
        createdAt: row.created_at,
        photoUrl,
        photoPath: row.photo_path,
        distanceM: row.distance_m,
      };
    }),
  );
}

export type PanelTaskRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  xp: number;
  coin: number;
  verification: string;
  difficulty: string;
  created_at: string;
};

export async function listPanelTasks(
  municipalityId: string | null,
): Promise<PanelTaskRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select("id,title,type,status,xp,coin,verification,difficulty,created_at")
    .order("created_at", { ascending: false });

  query =
    municipalityId === null
      ? query.is("municipality_id", null)
      : query.eq("municipality_id", municipalityId);

  const { data } = await query;
  return (data ?? []) as PanelTaskRow[];
}

export type PanelReportRow = {
  id: string;
  kind: string;
  title: string;
  description: string;
  status: string;
  photo_path: string | null;
  lat: number | null;
  lng: number | null;
  address_text: string | null;
  created_at: string;
  problem_categories: { name: string } | null;
  profiles: { username: string | null } | null;
};

export async function listPanelReports(
  municipalityId: string | null,
  filters: { status?: string; kind?: string } = {},
): Promise<PanelReportRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("problem_reports")
    .select(
      "id,kind,title,description,status,photo_path,lat,lng,address_text,created_at,problem_categories(name),profiles(username)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (municipalityId !== null) {
    query = query.eq("municipality_id", municipalityId);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.kind) {
    query = query.eq("kind", filters.kind);
  }

  const { data } = await query;
  return (data ?? []) as unknown as PanelReportRow[];
}
