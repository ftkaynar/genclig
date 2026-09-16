"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState } from "react";

import { setProblemStatusAction } from "@/lib/panel/actions";
import { Icon } from "@/components/ui/icon";
import type { PanelReportRow } from "@/lib/panel/queries";

const STATUS_OPTIONS = [
  { value: "reviewing", label: "İncelemeye al" },
  { value: "in_progress", label: "İşleme al" },
  { value: "resolved", label: "Çözüldü" },
  { value: "rejected", label: "Reddet" },
];

const STATUS_LABEL: Record<string, string> = {
  new: "Yeni",
  reviewing: "İnceleniyor",
  in_progress: "İşlemde",
  resolved: "Çözüldü",
  rejected: "Reddedildi",
};

const KIND_LABEL: Record<string, string> = {
  problem: "Sorun",
  oneri: "Öneri",
  proje: "Proje",
};

/**
 * Bildirim listesi ve durum yönetimi.
 * Durum değişimi set_problem_status üzerinden; yetki ve ödül mantığı orada.
 */
export function ReportList({ reports }: { reports: PanelReportRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function apply(id: string, status: string, withNote?: string) {
    setError(null);
    setPendingId(id);
    try {
      const result = await setProblemStatusAction(id, status, withNote);
      if (result.error) {
        setError(result.error);
        return;
      }
      setNoteFor(null);
      setNote("");
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  if (reports.length === 0) {
    return (
      <p className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-ink-muted">
        Bu filtreye uyan bildirim yok.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-status-danger/40 bg-status-danger/10 px-3.5 py-2.5 text-sm text-status-danger"
        >
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {reports.map((report) => (
          <li
            key={report.id}
            className="rounded-2xl border border-edge bg-card p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-ink-muted">
                {KIND_LABEL[report.kind] ?? report.kind}
                {report.problem_categories
                  ? ` · ${report.problem_categories.name}`
                  : null}
                {report.profiles?.username
                  ? ` · ${report.profiles.username}`
                  : null}
              </span>
              <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink">
                {STATUS_LABEL[report.status] ?? report.status}
              </span>
            </div>

            <p className="mt-1.5 text-sm font-semibold text-ink">
              {report.title}
            </p>
            <p className="mt-0.5 text-sm text-ink-muted">{report.description}</p>

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

            {report.photo_path ? (
              <p className="mt-1.5 break-all text-[11px] text-ink-muted">
                Fotoğraf: {report.photo_path}
              </p>
            ) : null}

            {noteFor === report.id ? (
              <div className="mt-3">
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Not (isteğe bağlı)"
                  className="w-full rounded-xl border border-edge bg-surface px-3 py-2 text-sm text-ink"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => apply(report.id, option.value, note)}
                      disabled={pendingId === report.id}
                      className="rounded-full border border-edge px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink disabled:opacity-60"
                    >
                      {option.label}
                    </button>
                  ))}
                  <Button variant="secondary" size="sm" type="button" onClick={() => setNoteFor(null)}>
                    Vazgeç
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" size="sm" type="button" onClick={() => setNoteFor(report.id)}>
                Durumu değiştir
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
