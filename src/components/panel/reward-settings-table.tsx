"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

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
  season: "Sezon",
};

/*
  Dönem sırası KODDA, sorguda değil.

  listAllRewardSettings `order by period` yapıyor ve bu alfabetik:
  month, season, week. Yönetici ekranında en kısa dönemden en uzuna
  gitmesi gerekiyor, yoksa "Aylık" satırları "Haftalık"tan önce
  görünüyor ve matris okunmuyor.
*/
const PERIOD_ORDER = ["week", "month", "season"];

const SCOPE_ORDER = ["turkiye", "takimlar"];

function sortKey(row: { scope: string; period: string; rank: number }): number {
  const s = SCOPE_ORDER.indexOf(row.scope);
  const p = PERIOD_ORDER.indexOf(row.period);
  // Bilinmeyen değerler sona: yeni bir kapsam/dönem eklenirse satır
  // kaybolmasın, yalnız listenin altına düşsün.
  return (s < 0 ? 9 : s) * 1000 + (p < 0 ? 9 : p) * 10 + row.rank;
}

/*
  Ödül ayarları tablosu — Hafta/Ay/Sezon x Bireysel/Takım matrisi.

  Satır satır kaydediliyor, tek bir "hepsini kaydet" düğmesiyle değil:
  on sekiz satırı tek seferde göndermek, yalnız birini değiştiren
  yöneticinin diğer on yediyi de yanlışlıkla ezmesine kapı açıyordu.

  Dönem sınırları arasında gri bir çizgi var: üç sıra bir dönemin
  bloğunu oluşturuyor ve blok sınırı görünmezse 1. sıranın hangi döneme
  ait olduğu on sekiz satırda karışıyordu.
*/
export function RewardSettingsTable({ rows }: { rows: RewardSetting[] }) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Record<string, { xp: number; token: number; active: boolean }>>(
    Object.fromEntries(
      rows.map((r) => [r.id, { xp: r.xp, token: r.token, active: r.active }]),
    ),
  );
  const [message, setMessage] = useState<string | null>(null);

  const ordered = [...rows].sort((a, b) => sortKey(a) - sortKey(b));

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
            {ordered.map((row, index) => {
              const value = draft[row.id];
              const changed =
                value.xp !== row.xp ||
                value.token !== row.token ||
                value.active !== row.active;

              // Dönem bloğunun ilk satırı: üstüne kalın ayırıcı.
              const blockStart =
                index > 0 &&
                (ordered[index - 1].period !== row.period ||
                  ordered[index - 1].scope !== row.scope);

              return (
                <tr
                  key={row.id}
                  className={
                    blockStart
                      ? "border-t-2 border-edge transition-colors hover:bg-surface"
                      : "transition-colors hover:bg-surface"
                  }
                >
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
                    <Button variant="primary" size="sm" type="button" onClick={() => save(row.id)} disabled={!changed || pending}>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="check" className="h-3 w-3" />
                        Kaydet
                      </span>
                    </Button>
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
