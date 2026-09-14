import Link from "next/link";

import { NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { ReportList } from "@/components/panel/report-list";
import { PANEL_NAV } from "@/lib/panel/nav";
import { getPanelContext } from "@/lib/panel/guard";
import { listPanelReports } from "@/lib/panel/queries";

export const metadata = { title: "Bildirimler — GençLİG Panel" };

const STATUS_FILTERS = [
  { key: "", label: "Tümü" },
  { key: "new", label: "Yeni" },
  { key: "reviewing", label: "İnceleniyor" },
  { key: "in_progress", label: "İşlemde" },
  { key: "resolved", label: "Çözüldü" },
  { key: "rejected", label: "Reddedildi" },
];

const KIND_FILTERS = [
  { key: "", label: "Tüm türler" },
  { key: "problem", label: "Sorun" },
  { key: "oneri", label: "Öneri" },
  { key: "proje", label: "Proje" },
];

export default async function PanelReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string; tur?: string }>;
}) {
  const context = await getPanelContext();
  if (!context) {
    return <NoAccess message="Bu sayfa belediye personeline açıktır." />;
  }

  const { durum, tur } = await searchParams;
  const status = STATUS_FILTERS.some((f) => f.key === durum) ? durum : "";
  const kind = KIND_FILTERS.some((f) => f.key === tur) ? tur : "";

  const reports = await listPanelReports(context.municipalityId, {
    status: status || undefined,
    kind: kind || undefined,
  });

  const href = (nextStatus: string, nextKind: string) =>
    `/panel/sorunlar?durum=${nextStatus}&tur=${nextKind}`;

  return (
    <PanelShell
      title="GençLİG Belediye Paneli"
      subtitle={`${context.municipalityName} · ${reports.length} bildirim`}
      nav={PANEL_NAV}
    >
      <div className="mb-4 flex flex-col gap-2">
        <ul className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <li key={filter.key || "all"}>
              <Link
                href={href(filter.key, kind ?? "")}
                className={
                  filter.key === status
                    ? "block rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                    : "block rounded-full border border-edge bg-card px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
                }
              >
                {filter.label}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap gap-2">
          {KIND_FILTERS.map((filter) => (
            <li key={filter.key || "allkind"}>
              <Link
                href={href(status ?? "", filter.key)}
                className={
                  filter.key === kind
                    ? "block rounded-full bg-xp/20 px-3 py-1 text-[11px] font-semibold text-xp"
                    : "block rounded-full border border-edge px-3 py-1 text-[11px] font-medium text-ink-muted hover:text-ink"
                }
              >
                {filter.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <ReportList reports={reports} />
    </PanelShell>
  );
}
