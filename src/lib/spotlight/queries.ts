import { createClient } from "@/lib/supabase/server";
import {
  isKnownMissing,
  isMissingSchema,
  markMissing,
} from "@/lib/supabase/schema-guard";
import type { TaskRow } from "@/lib/tasks/queries";
import { getTask } from "@/lib/tasks/queries";

/*
  Günün Görevi (D33 FAZ GG).

  Vitrin günde bir görev öne çıkarıyor ve o görevin ödülü İKİ KATI.
  Çarpanı arayüz DEĞİL veritabanı uyguluyor (award_task_points);
  buradaki iş yalnız "hangi görev" sorusunu sormak ve göstermek.

  ŞEMA GERİDE KALIRSA null dönüyor ve vitrin bandı hiç çizilmiyor —
  D32'de ölçtüğümüz kesintinin aynısını tekrarlamamak için (koşmamış
  migration'a sıkı bağımlılık).
*/

const SPOTLIGHT_RPC = "spotlight_task_id";

/** Bugünün vitrin görevi; yoksa null. */
export async function getSpotlightTaskId(): Promise<string | null> {
  if (isKnownMissing(SPOTLIGHT_RPC)) return null;

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("spotlight_task_id", {
    p_day: null,
  });

  if (error) {
    if (isMissingSchema(error)) markMissing(SPOTLIGHT_RPC);
    return null;
  }

  return (data as string | null) ?? null;
}

/**
 * Bugünün vitrin görevi; kayıt yoksa otomatik seçim tetikleniyor.
 *
 * TEMBEL YOL: pg_cron her ortamda kurulu değil (yerelde ölçüldü: kurulu
 * değil). Cron çalışmasa da ana sayfa ilk açıldığında vitrin doluyor.
 * Aynı desen D26'daki sıralama ödüllerinde kullanılmıştı.
 *
 * Seçim deterministik olduğu için iki kullanıcı aynı anda tetiklese de
 * aynı görevi buluyor.
 */
export async function getSpotlightTask(): Promise<TaskRow | null> {
  let taskId = await getSpotlightTaskId();

  if (!taskId && !isKnownMissing(SPOTLIGHT_RPC)) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("pick_daily_spotlight", {
      p_day: null,
    });

    if (error) {
      if (isMissingSchema(error)) markMissing(SPOTLIGHT_RPC);
      return null;
    }
    taskId = (data as string | null) ?? null;
  }

  if (!taskId) return null;

  /*
    Görev ayrıca getTask ile okunuyor: kart bileşeni TaskRow bekliyor ve
    aynı alan listesini burada ikinci kez yazmak, biri güncellenince
    ötekinin geride kalması demekti (D32'de art_key ile tam bunu
    yaşadık).

    getTask yalnız status='active' döndürüyor: vitrindeki görev sonradan
    pasife alındıysa band çizilmiyor.
  */
  return getTask(taskId);
}

/** Gün sonuna kalan süre (ms) — geri sayım için, Europe/Istanbul. */
export function msUntilIstanbulMidnight(now = new Date()): number {
  /*
    Türkiye 2016'dan beri sabit UTC+03:00. Tarih kısmı yine de Intl
    üzerinden alınıyor: sunucunun kendi saat dilimi ne olursa olsun
    "İstanbul'da bugün hangi gün" cevabı değişmemeli.
  */
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const midnight = new Date(`${today}T00:00:00+03:00`);
  midnight.setUTCDate(midnight.getUTCDate() + 1);

  return midnight.getTime() - now.getTime();
}

/** Geri sayımın ISO damgası — Countdown bileşeni bunu bekliyor. */
export function istanbulMidnightIso(now = new Date()): string {
  return new Date(now.getTime() + msUntilIstanbulMidnight(now)).toISOString();
}
