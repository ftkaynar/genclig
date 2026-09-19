import Link from "next/link";
import { Button } from "@/components/ui/button";

import { Icon } from "@/components/ui/icon";
import type { AuditRow } from "@/lib/panel/queries";

/*
  Denetim izi görünümü — hem /admin ana sayfasındaki akış hem
  /admin/denetim tablosu bunu kullanıyor.

  İki ayrı görünüm yazmak, aksiyon etiketleri değiştiğinde birini
  güncelleyip diğerini unutmaya açık kapı bırakıyordu.
*/

/** Aksiyon kodunun kullanıcıya görünen karşılığı, ikonu ve tonu. */
export const AUDIT_ACTION: Record<
  string,
  { label: string; icon: string; tone: string }
> = {
  "submission.approved": {
    label: "Teslim onayladı",
    icon: "check",
    tone: "bg-status-success/15 text-status-success",
  },
  "submission.rejected": {
    label: "Teslim reddetti",
    icon: "x",
    tone: "bg-status-danger/15 text-status-danger",
  },
  "problem.status": {
    label: "Bildirim durumu",
    icon: "megaphone",
    tone: "bg-amber/15 text-amber",
  },
  "message.delete": {
    label: "Mesaj sildi",
    icon: "trash-2",
    tone: "bg-status-danger/15 text-status-danger",
  },
  "message.restore": {
    label: "Mesajı geri açtı",
    icon: "recycle",
    tone: "bg-status-success/15 text-status-success",
  },
  "user.mute": {
    label: "Kullanıcı susturdu",
    icon: "shield",
    tone: "bg-status-warning/15 text-status-warning",
  },
  "report.create": {
    label: "Mesaj raporlandı",
    icon: "flag",
    tone: "bg-magenta/15 text-magenta",
  },
  "report.resolved": {
    label: "Rapor kapatıldı",
    icon: "check",
    tone: "bg-status-success/15 text-status-success",
  },
  "announcement.send": {
    label: "Duyuru gönderdi",
    icon: "bell",
    tone: "bg-primary/15 text-primary-ink",
  },
  "role.grant": {
    label: "Rol verdi",
    icon: "crown",
    tone: "bg-coin/15 text-coin",
  },
  "role.revoke": {
    label: "Rol aldı",
    icon: "lock",
    tone: "bg-status-danger/15 text-status-danger",
  },
  "task.create": {
    label: "Görev oluşturdu",
    icon: "list-checks",
    tone: "bg-indigo/15 text-indigo-ink",
  },
  "task.status": {
    label: "Görev durumu",
    icon: "activity",
    tone: "bg-indigo/15 text-indigo-ink",
  },
  "reward.redeem": {
    label: "Ödül alındı",
    icon: "gift",
    tone: "bg-coin/15 text-coin",
  },
  "reward.used": {
    label: "Kupon kullanıldı",
    icon: "check",
    tone: "bg-status-success/15 text-status-success",
  },
  "ticket.status": {
    label: "Destek durumu",
    icon: "hand-heart",
    tone: "bg-cyan/15 text-cyan",
  },
  "channel.migrate": {
    label: "Kanal taşıma",
    icon: "globe",
    tone: "bg-primary/15 text-primary-ink",
  },
};

export function auditLabel(action: string) {
  return (
    AUDIT_ACTION[action] ?? {
      label: action,
      icon: "activity",
      tone: "bg-surface text-ink-muted",
    }
  );
}

function when(value: string): string {
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Meta alanının okunur özeti; tam JSON detayda açılıyor. */
export function auditSummary(row: AuditRow): string {
  const m = row.meta ?? {};
  const pick = (k: string) => (m[k] === undefined ? null : String(m[k]));

  if (row.action === "channel.migrate") {
    return `${pick("moved_messages") ?? 0} mesaj, ${pick("moved_mutes") ?? 0} susturma taşındı`;
  }
  if (pick("title")) return pick("title") as string;
  if (pick("body")) return `“${pick("body")}”`;
  if (pick("from") && pick("to")) return `${pick("from")} → ${pick("to")}`;
  if (pick("role")) return pick("role") as string;
  if (pick("audience")) return `hedef: ${pick("audience")}`;
  return row.target_type;
}

/** Ana sayfadaki kompakt akış. */
export function AuditFeed({ rows }: { rows: AuditRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-edge bg-card px-4 py-6 text-center text-sm text-ink-muted">
        Henüz kayıt yok.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-edge overflow-hidden rounded-2xl border border-edge bg-card">
      {rows.map((row, i) => {
        const meta = auditLabel(row.action);
        return (
          <li
            key={row.id}
            className="tile-stagger flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-surface"
            style={{ "--i": i } as React.CSSProperties}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}
            >
              <Icon name={meta.icon} className="h-4 w-4" />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">
                {meta.label}
              </span>
              <span className="block truncate text-[11px] text-ink-muted">
                {row.actor_username ?? "sistem"} · {auditSummary(row)}
              </span>
            </span>

            <span className="shrink-0 text-[11px] tabular-nums text-ink-muted">
              {when(row.created_at)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Denetim sayfasındaki tam tablo. */
export function AuditTable({ rows }: { rows: AuditRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-ink-muted">
        Bu filtrede kayıt yok.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-edge bg-card">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead className="border-b border-edge bg-surface text-[11px] uppercase tracking-wide text-ink-muted">
          <tr>
            <th className="px-3.5 py-2.5 font-semibold">Zaman</th>
            <th className="px-3.5 py-2.5 font-semibold">Aktör</th>
            <th className="px-3.5 py-2.5 font-semibold">Aksiyon</th>
            <th className="px-3.5 py-2.5 font-semibold">Hedef</th>
            <th className="px-3.5 py-2.5 font-semibold">Ayrıntı</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-edge">
          {rows.map((row) => {
            const meta = auditLabel(row.action);
            return (
              <tr key={row.id} className="transition-colors hover:bg-surface">
                <td className="whitespace-nowrap px-3.5 py-2.5 tabular-nums text-ink-muted">
                  {when(row.created_at)}
                </td>
                <td className="px-3.5 py-2.5 font-medium text-ink">
                  {row.actor_username ?? (
                    <span className="text-ink-muted">sistem</span>
                  )}
                </td>
                <td className="px-3.5 py-2.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.tone}`}
                  >
                    <Icon name={meta.icon} className="h-3 w-3" />
                    {meta.label}
                  </span>
                </td>
                <td className="px-3.5 py-2.5 text-ink-muted">
                  <span className="block text-[11px]">{row.target_type}</span>
                  {row.target_id ? (
                    <span className="block font-mono text-[10px]">
                      {row.target_id.slice(0, 8)}
                    </span>
                  ) : null}
                </td>
                <td className="max-w-[320px] px-3.5 py-2.5">
                  <details>
                    <summary className="cursor-pointer truncate text-ink-muted">
                      {auditSummary(row)}
                    </summary>
                    <pre className="mt-1.5 overflow-x-auto rounded-lg bg-surface p-2 text-[10px] text-ink-muted">
                      {JSON.stringify(row.meta, null, 2)}
                    </pre>
                  </details>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Filtre şeridi — sunucu bileşeni, form GET ile URL'e yazıyor. */
export function AuditFilters({
  actions,
  current,
}: {
  actions: string[];
  current: { action?: string; from?: string; to?: string };
}) {
  return (
    <form
      method="get"
      className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl border border-edge bg-card p-3"
    >
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-ink-muted">Aksiyon</span>
        <select
          name="aksiyon"
          defaultValue={current.action ?? ""}
          className="rounded-xl border border-edge bg-surface px-2.5 py-1.5 text-xs text-ink"
        >
          <option value="">Tümü</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {auditLabel(a).label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-ink-muted">Başlangıç</span>
        <input
          type="date"
          name="baslangic"
          defaultValue={current.from ?? ""}
          className="rounded-xl border border-edge bg-surface px-2.5 py-1.5 text-xs text-ink"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-ink-muted">Bitiş</span>
        <input
          type="date"
          name="bitis"
          defaultValue={current.to ?? ""}
          className="rounded-xl border border-edge bg-surface px-2.5 py-1.5 text-xs text-ink"
        />
      </label>

      <Button variant="primary" size="sm" type="submit">
        Filtrele
      </Button>

      <Link
        href="/admin/denetim"
        className="rounded-full border border-edge px-4 py-2 text-xs font-medium text-ink-muted"
      >
        Temizle
      </Link>
    </form>
  );
}
