import { AdminShell } from "@/components/panel/admin-shell";
import { NoAccess } from "@/components/panel/panel-shell";
import {
  SpotlightPicker,
  type SpotlightDay,
  type SpotlightTaskOption,
} from "@/components/panel/spotlight-picker";
import { isSuperAdmin } from "@/lib/panel/guard";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Günün Görevi — GençLİG Admin" };

/** Europe/Istanbul takvim günü, ISO biçiminde. */
function istanbulDay(offsetDays = 0): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export default async function AdminSpotlightPage() {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  const supabase = await createClient();

  const today = istanbulDay(0);
  const tomorrow = istanbulDay(1);

  /*
    Aday görevler: aktif ve GLOBAL (belediyesiz).

    Belediyeye bağlı görev vitrine çıkamıyor — otomatik seçim de onları
    eliyor (pick_daily_spotlight). Listede göstermek, seçilince DB'den
    hata dönen bir seçenek sunmak olurdu.
  */
  const [{ data: pinned }, { data: taskRows }] = await Promise.all([
    supabase
      .from("daily_spotlight")
      .select("day,task_id,created_by,tasks(title)")
      .in("day", [today, tomorrow]),
    supabase
      .from("tasks")
      .select("id,title,xp,coin")
      .eq("status", "active")
      .is("municipality_id", null)
      .order("title"),
  ]);

  const rows = (pinned ?? []) as unknown as {
    day: string;
    task_id: string;
    created_by: string | null;
    tasks: { title: string } | null;
  }[];

  const byDay = new Map(rows.map((row) => [row.day, row]));

  const days: SpotlightDay[] = [
    { day: today, label: "Bugün" },
    { day: tomorrow, label: "Yarın" },
  ].map((item) => {
    const row = byDay.get(item.day);
    return {
      day: item.day,
      label: `${item.label} · ${item.day}`,
      taskId: row?.task_id ?? null,
      taskTitle: row?.tasks?.title ?? null,
      // created_by dolu = insan sabitledi, null = cron seçti.
      manual: Boolean(row?.created_by),
    };
  });

  const tasks = (taskRows ?? []) as SpotlightTaskOption[];

  return (
    <AdminShell subtitle={`${tasks.length} aday görev`}>
      <p className="mb-4 rounded-xl border border-edge bg-card px-3.5 py-2.5 text-xs text-ink-muted">
        Günün Görevi ülke çapında tek bir vitrindir ve o görevin XP/Token
        ödülü <strong className="text-ink">iki katına</strong> çıkar. Seçim
        yapılmazsa gün başında aktif global görevlerden otomatik seçilir.
        Geçmiş günler değiştirilemez.
      </p>

      <SpotlightPicker days={days} tasks={tasks} />
    </AdminShell>
  );
}
