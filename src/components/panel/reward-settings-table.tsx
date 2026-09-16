"use client";

import { useState, useTransition } from "react";

import { Icon } from "@/components/ui/icon";
import { updateRewardSettingAction } from "@/lib/leaderboard/reward-actions";
import type { RewardSetting } from "@/lib/leaderboard/rewards";

const SCOPE_LABEL: Record<string, string> = {
  turkiye: "Türkiye",
  takimlar: "Takım",
};

const PERIOD_LABEL: Record<string, string> = {
  week: "Haftalık",
  month: "Aylık",
};

/*
  Ödül ayarları tablosu.

  Satır satır kaydediliyor, tek bir "hepsini kaydet" düğmesiyle değil:
  on iki satırı tek seferde göndermek, yalnız birini değiştiren
  yöneticinin diğer on biri de yanlışlıkla ezmesine kapı açıyordu.
*/
export function RewardSettingsTable({ rows }: { rows: RewardSetting[] }) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Record<string, { xp: number; token: number; active: boolean }>>(
    Object.fromEntries(
      rows.map((r) => [r.id, { xp: r.xp, token: r.token, active: r.active }]),
    ),
  );
  const [message, setMessage] = useState<string | null>(null);

  function save(id: string) {
    const values = draft[id];
    if (!values) return;

    startTransition(async () => {
      const result = await updateRewardSettingAction(id, values);
      setMessage(result.error ?? result.notice ?? null);
    });
  }

  return (
    <>
      {message ? (
        <p
          role="status"
          className="mb-3 rounded-xl border border-edge bg-card px-3.5 py-2 text-xs text-ink-muted"
        >
          {message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-edge bg-card">
        <table className="w-full min-w-[620px] text-left text-[13px]">
          <thead className="border-b border-edge bg-surface text-[11px] uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-3.5 py-2.5 font-semibold">Kapsam</th>
              <th className="px-3.5 py-2.5 font-semibold">Dönem</th>
              <th className="px-3.5 py-2.5 font-semibold">Sıra</th>
              <th className="px-3.5 py-2.5 font-semibold">XP</th>
              <th className="px-3.5 py-2.5 font-semibold">Token</th>
              <th className="px-3.5 py-2.5 font-semibold">Aktif</th>
              <th className="px-3.5 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {rows.map((row) => {
              const value = draft[row.id];
              const changed =
                value.xp !== row.xp ||
                value.token !== row.token ||
                value.active !== row.active;

              return (
                <tr key={row.id} className="transition-colors hover:bg-surface">
                  <td className="px-3.5 py-2.5 font-medium text-ink">
                    {SCOPE_LABEL[row.scope] ?? row.scope}
                  </td>
                  <td className="px-3.5 py-2.5 text-ink-muted">
                    {PERIOD_LABEL[row.period] ?? row.period}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-coin/20 text-[11px] font-bold text-coin">
                      {row.rank}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <input
                      type="number"
                      min={0}
                      value={value.xp}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          [row.id]: { ...d[row.id], xp: Number(e.target.value) },
                        }))
                      }
                      className="w-20 rounded-lg border border-edge bg-surface px-2 py-1 text-xs tabular-nums text-ink"
                    />
                  </td>
                  <td className="px-3.5 py-2.5">
                    <input
                      type="number"
                      min={0}
                      value={value.token}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          [row.id]: {
                            ...d[row.id],
                            token: Number(e.target.value),
                          },
                        }))
                      }
                      className="w-20 rounded-lg border border-edge bg-surface px-2 py-1 text-xs tabular-nums text-ink"
                    />
                  </td>
                  <td className="px-3.5 py-2.5">
                    <input
                      type="checkbox"
                      checked={value.active}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          [row.id]: { ...d[row.id], active: e.target.checked },
                        }))
                      }
                      className="h-4 w-4 accent-[#7c3aed]"
                    />
                  </td>
                  <td className="px-3.5 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => save(row.id)}
                      disabled={!changed || pending}
                      className="btn-chunky bg-cta rounded-full px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Icon name="check" className="h-3 w-3" />
                        Kaydet
                      </span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
