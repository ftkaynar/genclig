import { createClient } from "@/lib/supabase/server";
import {
  isKnownMissing,
  isMissingSchema,
  markMissing,
} from "@/lib/supabase/schema-guard";
import {
  formatRemaining,
  formatStartsIn,
  taskTimeState,
  type TaskTimeState,
} from "@/lib/tasks/labels";
import { getViewerUser } from "@/lib/auth/viewer";

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
  starts_at: string | null;
  ends_at: string | null;
  capacity: number | null;
  icon: string | null;
  /** public/task-art/ altındaki kapak görselinin anahtarı (art-01..art-20). */
  art_key: string | null;
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
  /**
   * Zaman durumu ve başlangıç geri sayımının ilk metni — ikisi de
   * sunucuda hesaplanıyor. Bileşen içinde `Date.now()` çağırmak render'ı
   * saf olmaktan çıkarıyor (D07 ve D23'te aynı kurala takılmıştık).
   */
  timeState: TaskTimeState;
  startsInLabel: string | null;
};

/*
  Sorgu alanları iki parçaya ayrıldı.

  art_key M30 ile geldi. Migration koşmamış bir veritabanında bu
  sütunu istemek PostgREST'te 42703 veriyor ve SORGUNUN TAMAMI
  hata dönüyor — tek bir yeni sütun yüzünden görev akışı komple
  çöküyordu (ölçüldü: ana sayfa ve /gorevler 500).
*/
const TASK_FIELDS_BASE =
  "id,type,title,description,instructions,image_url,icon,xp,coin,difficulty,verification,scope,min_team_size,team_bonus_xp,team_bonus_coin,lat,lng,radius_m,starts_at,ends_at,capacity,task_categories(slug,name,icon)";

/** M30 sonrası eklenen alanlar. */
const TASK_FIELDS_ART = "art_key";

const ART_KEY = "tasks.art_key";

/** Şemanın desteklediği en geniş alan listesi. */
function taskFields(): string {
  return isKnownMissing(ART_KEY)
    ? TASK_FIELDS_BASE
    : `${TASK_FIELDS_BASE},${TASK_FIELDS_ART}`;
}

function withRemainingLabel(rows: unknown[]): TaskRow[] {
  const now = Date.now();
  return (rows as TaskRow[]).map((row) => {
    const timeState = taskTimeState(row.starts_at, row.ends_at, now);
    return {
      ...row,
      remainingLabel: row.ends_at
        ? formatRemaining(new Date(row.ends_at).getTime() - now)
        : null,
      timeState,
      startsInLabel:
        timeState === "upcoming" && row.starts_at
          ? formatStartsIn(new Date(row.starts_at).getTime() - now)
          : null,
    };
  });
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

  /*
    Sorgu iki kez kurulabilmeli (art_key'li ve art_key'siz), bu yüzden
    kurulum bir fonksiyona alındı. Aynı zinciri iki yere kopyalamak,
    filtrelerden birinin ilerde yalnız bir dalda güncellenmesi demekti.
  */
  const build = (fields: string) => {
    let q = supabase
      .from("tasks")
      .select(fields)
      .eq("status", "active")
      .in("type", [...FEED_TASK_TYPES])
      // Süresi dolmuş görevler feed'den düşüyor; başlamamış olanlar
      // DÜŞMÜYOR — kullanıcı yaklaşan etkinliği önceden görebilmeli.
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: true });

    if (type && (FEED_TASK_TYPES as readonly string[]).includes(type)) {
      q = q.eq("type", type);
    }

    // Bireysel/Takım ayrımı da veritabanında: tip filtresiyle aynı gerekçe.
    if (scope && (FEED_TASK_SCOPES as readonly string[]).includes(scope)) {
      q = q.eq("scope", scope);
    }

    return q;
  };

  let { data, error } = await build(taskFields());

  // Sütun yoksa art_key'siz bir kez daha dene ve durumu hatırla.
  if (error && isMissingSchema(error)) {
    markMissing(ART_KEY);
    ({ data, error } = await build(TASK_FIELDS_BASE));
  }

  if (error) {
    throw new Error(`Görevler alınamadı: ${error.message}`);
  }

  return withRemainingLabel(data ?? []);
}

/** Tek görev. Bulunamazsa null; RLS gizlediğinde de aynı sonucu verir. */
export async function getTask(id: string): Promise<TaskRow | null> {
  const supabase = await createClient();

  const read = (fields: string) =>
    supabase
      .from("tasks")
      .select(fields)
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle();

  let { data, error } = await read(taskFields());

  /*
    Buradaki hata eskiden YUTULUYORDU (`const { data }`) ve art_key
    olmayan bir şemada her görev detayı sessizce 404 oluyordu.
    Artık eksik sütun fark ediliyor ve eski alan listesiyle
    yeniden okunuyor.
  */
  if (error && isMissingSchema(error)) {
    markMissing(ART_KEY);
    ({ data, error } = await read(TASK_FIELDS_BASE));
  }

  return data ? (withRemainingLabel([data])[0] ?? null) : null;
}

export type SubmissionSummary = {
  status: string;
  /**
   * Teslim, İÇİNDE BULUNULAN görev gününe mi ait?
   *
   * Görev günü Europe/Istanbul 06:00'da başlıyor (M31). Sürekli
   * görevin tamamlanma tiki bu pencereye bağlı: dünkü teslim bugünün
   * kartını tamamlanmış göstermemeli, kart "Tekrar yap"a dönmeli.
   *
   * Hesap SUNUCUDA: bileşen içinde Date.now() çağırmak render'ı saf
   * olmaktan çıkarıyor ve lint bunu hata sayıyor (D07, D23, D29).
   */
  isToday: boolean;
};

/**
 * İçinde bulunulan görev gününün başlangıcı (Europe/Istanbul 06:00).
 *
 * DB'deki task_day_start() ile AYNI kural. İki yerde durmasının nedeni:
 * sayfa render'ı için tek satırlık bir hesabı RPC'ye çevirmek her kart
 * listesine bir gidiş-dönüş ekliyordu. Kural değişirse İKİSİ de
 * değişmeli — bu yüzden her iki tarafta da 06:00 sabiti tek bir yerde.
 */
export const TASK_DAY_START_HOUR = 6;

export function taskDayStart(now = new Date()): Date {
  /*
    Türkiye 2016'dan beri sabit UTC+03:00 (yaz saati kaldırıldı), bu
    yüzden ofset doğrudan yazılabiliyor. Tarih kısmı yine de Intl
    üzerinden: sunucunun kendi saat dilimi ne olursa olsun
    "İstanbul'da bugün hangi gün" cevabı değişmemeli.
  */
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  const local = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = Number(get("hour"));

  const pad = String(TASK_DAY_START_HOUR).padStart(2, "0");
  const start = new Date(`${local}T${pad}:00:00+03:00`);

  // 06:00'dan önceysek hâlâ DÜNKÜ görev günündeyiz.
  if (hour < TASK_DAY_START_HOUR) {
    start.setUTCDate(start.getUTCDate() - 1);
  }
  return start;
}

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
  const user = await getViewerUser();

  if (!user) {
    return result;
  }

  const { data } = await supabase
    .from("task_submissions")
    .select("task_id,status,created_at")
    .eq("user_id", user.id)
    .in("task_id", taskIds)
    .order("created_at", { ascending: false });

  const dayStart = taskDayStart().getTime();

  /*
    En yeni teslim kazanıyor: sıralama azalan, ilk gelen yazılıyor,
    sonrakiler atlanıyor. Sürekli görevde aynı görevin onlarca teslimi
    olabiliyor ve kartın durumu SON teslime göre belirlenmeli —
    sırasız okumada dünkü onaylı teslim bugünkü reddedilmişin önüne
    geçip kartı yanlış gösteriyordu.
  */
  for (const row of data ?? []) {
    if (result.has(row.task_id)) continue;
    result.set(row.task_id, {
      status: row.status,
      isToday: new Date(row.created_at).getTime() >= dayStart,
    });
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
  return getViewerUser();
}
