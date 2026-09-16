import { createClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/unwrap";
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
 * ÖLÇÜLEN HATA (D29 FAZ T) — ASIL SEBEP: bu sorgu `profiles(username)`
 * gömüyordu ama `task_submissions` ile `profiles` arasında FOREIGN KEY
 * YOK; ikisi de ayrı ayrı `auth.users(id)`'ye bakıyor. PostgREST bu
 * ilişkiyi çözemiyor ve sorgunun TAMAMI patlıyor:
 *
 *     Could not find a relationship between 'task_submissions'
 *     and 'profiles' in the schema cache
 *
 * Çağıran taraf hatayı okumadığı için ekran boş kuyruk gösteriyordu.
 * Bulutta ölçüldü: gömme ile 0 satır (hata), gömme olmadan 1 satır.
 *
 * Kullanıcı adı artık ikinci bir sorguyla çekiliyor. Denenen ve elenen
 * alternatif: `task_submissions.user_id -> profiles(id)` FK eklemek.
 * Elendi — aynı kolonda ikinci bir FK, PostgREST'in her gömmesini
 * belirsiz hâle getirip her çağrıda ipucu söz dizimi gerektiriyordu.
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
      "id,created_at,photo_path,distance_m,user_id,tasks!inner(title,municipality_id,municipalities(name))",
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

  const rows = unwrap(await query, "Bekleyen teslimler") as unknown as {
    id: string;
    created_at: string;
    photo_path: string | null;
    distance_m: number | null;
    user_id: string;
    tasks: {
      title: string;
      municipalities: { name: string } | null;
    } | null;
  }[];

  /*
    Kullanıcı adları ayrı sorguda: gömme mümkün değil (yukarıdaki not).
    Tek `in` sorgusu — satır başına sorgu açmak N+1 olurdu.

    profiles RLS'i yalnızca kendi satırını ve süper admini geçiriyor,
    yani belediye personelinde ad null dönüyor ve ekranda "Kullanıcı"
    yazıyor. Bu kasıtlı: personelin başka belediyenin kullanıcısını
    tanıması gerekmiyor.
  */
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const nameById = new Map<string, string | null>();

  if (userIds.length > 0) {
    const names = unwrap(
      await supabase.from("profiles").select("id,username").in("id", userIds),
      "Teslim sahiplerinin adları",
    ) as unknown as { id: string; username: string | null }[];

    for (const row of names) {
      nameById.set(row.id, row.username);
    }
  }

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
        username: nameById.get(row.user_id) ?? null,
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

/*
  Aynı kök sebep incelemelerdeki gibi: problem_reports ile profiles
  arasında FK yok, `profiles(username)` gömmesi sorgunun tamamını
  patlatıyordu (bulutta ölçüldü). Ad ikinci sorguyla çekiliyor.
*/

export async function listPanelReports(
  municipalityId: string | null,
  filters: { status?: string; kind?: string } = {},
): Promise<PanelReportRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("problem_reports")
    .select(
      "id,kind,title,description,status,photo_path,lat,lng,address_text,created_at,user_id,problem_categories(name)",
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

  const rows = unwrap(await query, "Sorun bildirimleri") as unknown as
    (Omit<PanelReportRow, "profiles"> & { user_id: string })[];

  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const nameById = new Map<string, string | null>();

  if (userIds.length > 0) {
    const names = unwrap(
      await supabase.from("profiles").select("id,username").in("id", userIds),
      "Bildirim sahiplerinin adları",
    ) as unknown as { id: string; username: string | null }[];

    for (const row of names) {
      nameById.set(row.id, row.username);
    }
  }

  return rows.map((row) => ({
    ...row,
    profiles: { username: nameById.get(row.user_id) ?? null },
  }));
}

/* ---------------------------------------------------------------------------
   Süper admin: bekleyen iş sayaçları ve denetim izi (D29)
   --------------------------------------------------------------------------- */

export type AdminBadgeCounts = {
  reviews: number;
  problems: number;
  moderation: number;
  support: number;
};

/**
 * Üst şeritteki ve sol sütundaki bekleyen iş rozetleri.
 *
 * Dört `head: true` sayım sorgusu paralel gidiyor; hiçbiri satır
 * taşımıyor. Ayrı bir RPC yazılmadı: RLS bu tabloların hepsinde süper
 * admini zaten geçiriyor ve sayımı veritabanı fonksiyonuna taşımak,
 * değişen her sayaç için yeni bir migration demekti.
 */
export async function getAdminBadges(): Promise<AdminBadgeCounts> {
  const supabase = await createClient();

  const [reviews, problems, moderation, support] = await Promise.all([
    supabase
      .from("task_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("problem_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("message_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
  ]);

  return {
    reviews: reviews.count ?? 0,
    problems: problems.count ?? 0,
    moderation: moderation.count ?? 0,
    support: support.count ?? 0,
  };
}

export type AuditRow = {
  id: string;
  actor_id: string | null;
  actor_username: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

/**
 * Denetim izi kayıtları.
 *
 * Aktör adı ikinci sorguyla çekiliyor: audit_logs ile profiles arasında
 * FK yok (actor_id auth.users'a bakıyor) ve gömme denemek sorgunun
 * tamamını patlatırdı — D29 FAZ T'de tam olarak bu hata ölçüldü.
 */
export async function listAuditLogs(filters: {
  action?: string;
  actor?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<AuditRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("audit_logs")
    .select("id,actor_id,action,target_type,target_id,meta,created_at")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 200);

  if (filters.action) query = query.eq("action", filters.action);
  if (filters.actor) query = query.eq("actor_id", filters.actor);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);

  const rows = unwrap(await query, "Denetim izi") as unknown as Omit<
    AuditRow,
    "actor_username"
  >[];

  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
  const nameById = new Map<string, string | null>();

  if (actorIds.length > 0) {
    const names = unwrap(
      await supabase.from("profiles").select("id,username").in("id", actorIds),
      "Denetim aktörleri",
    ) as unknown as { id: string; username: string | null }[];
    for (const row of names) nameById.set(row.id, row.username);
  }

  return rows.map((row) => ({
    ...row,
    actor_username: row.actor_id ? (nameById.get(row.actor_id) ?? null) : null,
  }));
}

/** Denetim izinde geçen aksiyon tipleri — filtre açılır listesi için. */
export async function listAuditActions(): Promise<string[]> {
  const supabase = await createClient();
  const rows = unwrap(
    await supabase.from("audit_logs").select("action").limit(1000),
    "Denetim aksiyonları",
  ) as unknown as { action: string }[];
  return [...new Set(rows.map((r) => r.action))].sort();
}
