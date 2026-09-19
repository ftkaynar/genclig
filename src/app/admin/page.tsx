import Link from "next/link";

import { AdminShell } from "@/components/panel/admin-shell";
import { AuditFeed } from "@/components/panel/audit-feed";
import { KpiCard, NoAccess } from "@/components/panel/panel-shell";
import { Icon } from "@/components/ui/icon";
import { isSuperAdmin } from "@/lib/panel/guard";
import { listAuditLogs } from "@/lib/panel/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Süper Admin — GençLİG" };

/** Bugünün Europe/Istanbul başlangıcı, ISO olarak. */
function istanbulDayStart(): string {
  /*
    Gün sınırı Europe/Istanbul: sunucu UTC ve "bugünkü teslim" sayısı
    gece yarısından sonra üç saat boyunca yanlış çıkıyordu (aynı sınıf
    hata D09 ve D25'te ölçülmüştü).
  */
  const now = new Date();
  const tr = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }),
  );
  tr.setHours(0, 0, 0, 0);
  // Yerel-saat farkını geri ekleyerek gerçek ana dönüyoruz.
  const offset = now.getTime() - new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }),
  ).getTime();
  return new Date(tr.getTime() + offset).toISOString();
}

export default async function AdminPage() {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  const supabase = await createClient();

  const [{ data }, todayRes, openSupport, audit] = await Promise.all([
    supabase.rpc("admin_kpis"),
    supabase
      .from("task_submissions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", istanbulDayStart()),
    supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    listAuditLogs({ limit: 10 }),
  ]);

  const kpi = (Array.isArray(data) ? data[0] : data) as
    | {
        users_total: number;
        municipalities_total: number;
        tasks_total: number;
        pending_reviews: number;
        reports_total: number;
        reports_open: number;
        redemptions_total: number;
      }
    | undefined;

  return (
    <AdminShell
      subtitle="Platformun güncel durumu"
      action={
        <Link
          href="/admin/denetim"
          className="press-soft inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-indigo/70 bg-card px-3.5 text-[13px] font-semibold text-white"
        >
          <Icon name="search" className="h-3.5 w-3.5" />
          Tüm denetim izi
        </Link>
      }
    >
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Kullanıcı" value={kpi?.users_total ?? 0} />
        <KpiCard label="Aktif görev" value={kpi?.tasks_total ?? 0} />
        <KpiCard
          label="Bekleyen inceleme"
          value={kpi?.pending_reviews ?? 0}
          tone={kpi && kpi.pending_reviews > 0 ? "warning" : "ink"}
        />
        <KpiCard
          label="Açık sorun"
          value={kpi?.reports_open ?? 0}
          tone={kpi && kpi.reports_open > 0 ? "danger" : "ink"}
        />
        <KpiCard
          label="Açık destek"
          value={openSupport.count ?? 0}
          tone={(openSupport.count ?? 0) > 0 ? "warning" : "ink"}
        />
        <KpiCard
          label="Bugünkü teslim"
          value={todayRes.count ?? 0}
          tone="primary"
        />
      </section>

      <section className="mt-5">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Icon name="activity" className="h-4 w-4 text-primary-ink" />
          Son aktiviteler
        </h2>
        <AuditFeed rows={audit} />
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Belediye" value={kpi?.municipalities_total ?? 0} />
        <KpiCard label="Toplam bildirim" value={kpi?.reports_total ?? 0} />
        <KpiCard label="Kupon" value={kpi?.redemptions_total ?? 0} />
      </section>
    </AdminShell>
  );
}
