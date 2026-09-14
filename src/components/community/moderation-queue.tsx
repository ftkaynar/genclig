"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  moderateDeleteAction,
  moderateRestoreAction,
  muteUserAction,
  resolveReportAction,
} from "@/lib/community/actions";
import { MUTE_OPTIONS, type ModerationRow } from "@/lib/community/labels";

/*
  Moderasyon kuyruğu.

  Sıralama sunucuda: en çok raporlanan üstte, eşitlikte en eski. Moderatör
  kuyruğa baktığında en acil olanı ilk görmeli.

  Üç eylem ayrı ayrı duruyor — "sil" ile "raporu kapat" bilerek
  birleştirilmedi: bir mesaj haksız yere raporlanmış olabilir ve o durumda
  doğru karar silmek değil raporu kapatmak.
*/
export function ModerationQueue({
  rows,
  canMuteGlobally,
}: {
  rows: ModerationRow[];
  /** Süper adminde global susturma da açık. */
  canMuteGlobally: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [muteFor, setMuteFor] = useState<string | null>(null);
  const [muteMinutes, setMuteMinutes] = useState<number>(60);
  const [muteReason, setMuteReason] = useState("");

  async function run(fn: () => Promise<{ error?: string; notice?: string }>) {
    setMessage(null);
    setPending(true);
    try {
      const result = await fn();
      setMessage(result.error ?? result.notice ?? null);
      if (!result.error) {
        setMuteFor(null);
        setMuteReason("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-ink-muted">
        Açık rapor yok. Kuyruk temiz.
      </p>
    );
  }

  return (
    <div>
      {message ? (
        <p
          role="status"
          className="mb-3 rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink-muted"
        >
          {message}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li
            key={row.message_id}
            className={`rounded-2xl border-2 bg-card p-4 ${
              row.report_count >= 3 ? "border-status-danger/50" : "border-edge"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-status-danger/15 px-2.5 py-0.5 text-[11px] font-bold text-status-danger">
                {row.report_count} rapor
              </span>
              {row.is_deleted ? (
                <span className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-ink-muted">
                  Gizlenmiş
                </span>
              ) : null}
              <span className="text-[11px] text-ink-muted">
                {row.channel_name} · {row.author_username} ·{" "}
                {new Date(row.created_at).toLocaleString("tr-TR")}
              </span>
            </div>

            <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface px-3.5 py-2.5 text-sm text-ink">
              {row.body}
            </p>

            {row.reasons ? (
              <p className="mt-1.5 text-[11px] text-ink-muted">
                Gerekçe: {row.reasons}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {row.is_deleted ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => moderateRestoreAction(row.message_id))}
                  className="rounded-full border border-edge px-3.5 py-1.5 text-xs font-medium text-ink disabled:opacity-60"
                >
                  Geri aç
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => moderateDeleteAction(row.message_id))}
                  className="rounded-full border border-status-danger/50 px-3.5 py-1.5 text-xs font-semibold text-status-danger disabled:opacity-60"
                >
                  Sil
                </button>
              )}

              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  setMuteFor(muteFor === row.message_id ? null : row.message_id)
                }
                className="rounded-full border border-edge px-3.5 py-1.5 text-xs font-medium text-ink-muted disabled:opacity-60"
              >
                Kullanıcıyı sustur
              </button>

              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => resolveReportAction(row.message_id))}
                className="rounded-full border border-edge px-3.5 py-1.5 text-xs font-medium text-ink-muted disabled:opacity-60"
              >
                Raporu kapat
              </button>
            </div>

            {muteFor === row.message_id ? (
              <div className="mt-3 rounded-xl border border-edge bg-surface p-3">
                <p className="text-xs font-semibold text-ink">
                  {row.author_username} ne kadar susturulsun?
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {MUTE_OPTIONS.map((option) => (
                    <button
                      key={option.minutes}
                      type="button"
                      onClick={() => setMuteMinutes(option.minutes)}
                      aria-pressed={muteMinutes === option.minutes}
                      className={
                        muteMinutes === option.minutes
                          ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white"
                          : "rounded-full border border-edge px-3 py-1 text-xs font-medium text-ink-muted"
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <input
                  value={muteReason}
                  onChange={(event) => setMuteReason(event.target.value)}
                  placeholder="Gerekçe (kullanıcıya bildirilir)"
                  maxLength={120}
                  className="mt-2.5 w-full rounded-xl border border-edge bg-card px-3.5 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary"
                />

                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        muteUserAction({
                          userId: row.author_id,
                          channelId: null,
                          minutes: muteMinutes,
                          reason: muteReason,
                        }),
                      )
                    }
                    className="btn-chunky bg-cta rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    hidden={!canMuteGlobally}
                  >
                    Tüm kanallarda sustur
                  </button>

                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        muteUserAction({
                          userId: row.author_id,
                          channelId: row.channel_id,
                          minutes: muteMinutes,
                          reason: muteReason,
                        }),
                      )
                    }
                    className="btn-chunky bg-cta rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    Bu kanalda sustur
                  </button>

                  <button
                    type="button"
                    onClick={() => setMuteFor(null)}
                    className="rounded-full border border-edge px-4 py-1.5 text-xs font-medium text-ink-muted"
                  >
                    Vazgeç
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
