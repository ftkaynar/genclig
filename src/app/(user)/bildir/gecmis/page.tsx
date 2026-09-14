import Link from "next/link";
import { redirect } from "next/navigation";

import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHeader } from "@/components/user-header";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/pills";
import { relativeTime } from "@/lib/notifications/queries";
import {
  KIND_LABEL,
  PROBLEM_STATUS_LABEL,
  PROBLEM_STATUS_TONE,
  getReportHistory,
  listMyReports,
} from "@/lib/problems/queries";
import { getViewerUser } from "@/lib/auth/viewer";

export const metadata = {
  title: "Bildirimlerim — GençLİG",
};

export default async function MyReportsPage() {
  const user = await getViewerUser();

  if (!user) {
    redirect("/giris?next=/bildir/gecmis");
  }

  const reports = await listMyReports();

  // Geçmişler tek seferde çekiliyor: rapor sayısı kullanıcı başına küçük.
  const histories = await Promise.all(
    reports.map((report) => getReportHistory(report.id)),
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHeader title="Bildirimlerim" signedIn />

      <main className="flex-1 px-4 py-4">
        {reports.length === 0 ? (
          <EmptyState
            icon="megaphone"
            title="Henüz bildirim göndermedin"
            description="Mahallende gördüğün bir sorunu ya da fikrini belediyene ilet."
            action={
              <Link
                href="/bildir"
                className="inline-block rounded-full btn-chunky bg-cta px-5 py-2.5 text-sm font-semibold text-white"
              >
                İlk bildirimini gönder
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {reports.map((report, index) => (
              <li
                key={report.id}
                className="rounded-2xl border border-edge bg-card p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-ink-muted">
                    {KIND_LABEL[report.kind] ?? report.kind}
                    {report.problem_categories
                      ? ` · ${report.problem_categories.name}`
                      : null}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      PROBLEM_STATUS_TONE[report.status] ??
                      "bg-surface text-ink-muted"
                    }`}
                  >
                    {PROBLEM_STATUS_LABEL[report.status] ?? report.status}
                  </span>
                </div>

                <p className="mt-1.5 text-sm font-semibold text-ink">
                  {report.title}
                </p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {report.description}
                </p>

                {report.address_text ? (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-ink-muted">
                    <Icon name="map-pin" className="h-3.5 w-3.5 shrink-0" />
                    {report.address_text}
                  </p>
                ) : null}

                {report.lat !== null && report.lng !== null ? (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${report.lat}&mlon=${report.lng}#map=18/${report.lat}/${report.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-block text-xs font-medium text-primary hover:underline"
                  >
                    Haritada gör
                  </a>
                ) : null}

                {histories[index].length > 0 ? (
                  <ol className="mt-3 border-t border-edge pt-2.5">
                    {histories[index].map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-start justify-between gap-3 py-1 text-[11px]"
                      >
                        <span className="text-ink-muted">
                          {PROBLEM_STATUS_LABEL[entry.new_status] ??
                            entry.new_status}
                          {entry.note ? ` — ${entry.note}` : null}
                        </span>
                        <span className="shrink-0 text-ink-muted">
                          {relativeTime(entry.created_at)}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </main>

      <UserBottomNav active="home" />
    </div>
  );
}
