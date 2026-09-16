"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  clearSpotlightAction,
  setSpotlightAction,
} from "@/lib/spotlight/actions";

export type SpotlightDay = {
  /** ISO tarih (YYYY-MM-DD, Europe/Istanbul takvim günü). */
  day: string;
  label: string;
  taskId: string | null;
  taskTitle: string | null;
  /** Elle mi sabitlendi, yoksa otomatik mi seçildi? */
  manual: boolean;
};

export type SpotlightTaskOption = {
  id: string;
  title: string;
  xp: number;
  coin: number;
};

/*
  Günün Görevi seçici (D33 FAZ GG).

  Yalnız iki gün: bugün ve yarın. Geçmiş bir günü değiştirmek, o gün
  2x ödül almış teslimlerle çelişirdi — ödül zaten yazılmış olur ve
  vitrin kaydı onu artık anlatmaz. Kural DB'de de var
  (set_daily_spotlight), buradaki arayüz onu yalnız görünür kılıyor.

  Ekran bilerek basit: arama kutusu yok, açılır liste var. Yönetici
  günde bir kez, bilinçli bir seçim yapıyor; bu bir tarama işi değil.
*/
export function SpotlightPicker({
  days,
  tasks,
}: {
  days: SpotlightDay[];
  tasks: SpotlightTaskOption[];
}) {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});

  async function run(fn: () => Promise<{ error?: string; notice?: string }>) {
    setPending(true);
    setNotice(null);
    try {
      const result = await fn();
      setNotice(result.error ?? result.notice ?? null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-edge bg-card px-3.5 py-2 text-sm text-ink"
        >
          {notice}
        </p>
      ) : null}

      {days.map((item) => (
        <section
          key={item.day}
          className="rounded-2xl border border-edge bg-card p-4"
        >
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <Icon name="star" className="h-4 w-4 text-coin" />
            {item.label}
          </p>

          <p className="mt-1 text-xs text-ink-muted">
            {item.taskTitle ? (
              <>
                <span className="font-semibold text-ink">{item.taskTitle}</span>
                {" · "}
                {item.manual ? "elle sabitlendi" : "otomatik seçildi"}
              </>
            ) : (
              "Henüz seçilmedi — gün başında otomatik seçilecek."
            )}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={choice[item.day] ?? item.taskId ?? ""}
              onChange={(event) =>
                setChoice((prev) => ({
                  ...prev,
                  [item.day]: event.target.value,
                }))
              }
              className="min-h-[40px] min-w-0 flex-1 rounded-xl border border-edge bg-surface px-3 text-sm text-ink outline-none focus:border-primary"
            >
              <option value="">Görev seç</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title} (+{task.xp} XP / +{task.coin})
                </option>
              ))}
            </select>

            <Button
              variant="gold"
              size="sm"
              type="button"
              icon="star"
              disabled={pending || !(choice[item.day] ?? item.taskId)}
              onClick={() =>
                run(() =>
                  setSpotlightAction(
                    item.day,
                    choice[item.day] ?? item.taskId ?? "",
                  ),
                )
              }
            >
              Günün Görevi yap
            </Button>

            {item.taskId ? (
              <Button
                variant="secondary"
                size="sm"
                type="button"
                disabled={pending}
                onClick={() => run(() => clearSpotlightAction(item.day))}
              >
                Kaldır
              </Button>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}
