"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  deleteChainAction,
  saveChainAction,
  type AdminChainRow,
} from "@/lib/chains/admin";

export type ChainTaskOption = { id: string; title: string };

const EMPTY: AdminChainRow = {
  id: "",
  title: "",
  description: "",
  icon: "list-checks",
  bonus_xp: 100,
  bonus_token: 100,
  status: "active",
  sort: 0,
  step_ids: [],
};

const inputClass =
  "min-h-[40px] w-full rounded-xl border border-edge bg-surface px-3 text-sm text-ink outline-none focus:border-primary";

/*
  Zincir düzenleyici (D33 FAZ Z).

  Adım seçimi iki parçalı: solda görev listesi, sağda SEÇİLENLER SIRALI.
  Tek bir çoklu seçim kutusu denendi ve elendi — seçim sırası
  görünmüyordu ve zincirin adım sırası tam olarak o.

  Sıra yukarı/aşağı düğmeleriyle. Sürükle-bırak denendi ve elendi:
  dokunmatik ekranda sürükleme kaydırma ile çakışıyor ve yönetici
  ekranı için gereğinden fazla iş.
*/
export function ChainEditor({
  chains,
  tasks,
}: {
  chains: AdminChainRow[];
  tasks: ChainTaskOption[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<AdminChainRow | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const taskTitle = new Map(tasks.map((task) => [task.id, task.title]));

  function set<K extends keyof AdminChainRow>(
    key: K,
    value: AdminChainRow[K],
  ) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function moveStep(index: number, delta: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev.step_ids];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, step_ids: next };
    });
  }

  async function run(fn: () => Promise<{ error?: string; notice?: string }>) {
    setPending(true);
    setNotice(null);
    try {
      const result = await fn();
      setNotice(result.error ?? result.notice ?? null);
      if (!result.error) {
        setDraft(null);
        router.refresh();
      }
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

      {!draft ? (
        <div>
          <Button
            variant="primary"
            size="sm"
            type="button"
            icon="sparkles"
            onClick={() => setDraft({ ...EMPTY })}
          >
            Yeni zincir
          </Button>
        </div>
      ) : null}

      {/* ------------------------------------------------------- düzenleyici */}
      {draft ? (
        <section className="rounded-2xl border border-primary/50 bg-card p-4">
          <p className="mb-3 text-sm font-bold text-ink">
            {draft.id ? "Zinciri düzenle" : "Yeni zincir"}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-ink">
                Başlık
              </span>
              <input
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
                className={inputClass}
                placeholder="Kültür Kaşifi"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-ink">
                Açıklama
              </span>
              <input
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
                className={inputClass}
                placeholder="Üç görevi tamamla, bonusu kap."
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-medium text-ink">
                İkon
              </span>
              <input
                value={draft.icon ?? ""}
                onChange={(e) => set("icon", e.target.value)}
                className={inputClass}
                placeholder="palette"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-medium text-ink">
                Sıra
              </span>
              <input
                type="number"
                value={draft.sort}
                onChange={(e) => set("sort", Number(e.target.value))}
                className={inputClass}
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-medium text-ink">
                Bonus XP
              </span>
              <input
                type="number"
                value={draft.bonus_xp}
                onChange={(e) => set("bonus_xp", Number(e.target.value))}
                className={inputClass}
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-medium text-ink">
                Bonus Token
              </span>
              <input
                type="number"
                value={draft.bonus_token}
                onChange={(e) => set("bonus_token", Number(e.target.value))}
                className={inputClass}
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-medium text-ink">
                Durum
              </span>
              <select
                value={draft.status}
                onChange={(e) => set("status", e.target.value)}
                className={inputClass}
              >
                <option value="active">Yayında</option>
                <option value="passive">Pasif</option>
              </select>
            </label>
          </div>

          {/* ------------------------------------------------------- adımlar */}
          <p className="mb-1 mt-4 text-xs font-medium text-ink">
            Adımlar ({draft.step_ids.length})
          </p>

          <ol className="mb-2 flex flex-col gap-1.5">
            {draft.step_ids.map((taskId, index) => (
              <li
                key={taskId}
                className="flex items-center gap-2 rounded-xl border border-edge bg-surface px-2.5 py-1.5"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo/15 text-[11px] font-bold text-indigo-ink">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                  {taskTitle.get(taskId) ?? taskId}
                </span>
                <button
                  type="button"
                  aria-label="Yukarı taşı"
                  onClick={() => moveStep(index, -1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:text-ink"
                >
                  <Icon name="chevron-right" className="h-4 w-4 -rotate-90" />
                </button>
                <button
                  type="button"
                  aria-label="Aşağı taşı"
                  onClick={() => moveStep(index, 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:text-ink"
                >
                  <Icon name="chevron-right" className="h-4 w-4 rotate-90" />
                </button>
                <button
                  type="button"
                  aria-label="Çıkar"
                  onClick={() =>
                    set(
                      "step_ids",
                      draft.step_ids.filter((item) => item !== taskId),
                    )
                  }
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-status-danger"
                >
                  <Icon name="x" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ol>

          <select
            value=""
            onChange={(e) => {
              const value = e.target.value;
              if (!value || draft.step_ids.includes(value)) return;
              set("step_ids", [...draft.step_ids, value]);
            }}
            className={inputClass}
          >
            <option value="">Adım ekle…</option>
            {tasks
              .filter((task) => !draft.step_ids.includes(task.id))
              .map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
          </select>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  saveChainAction({
                    id: draft.id || undefined,
                    title: draft.title,
                    description: draft.description,
                    icon: draft.icon ?? "",
                    bonusXp: String(draft.bonus_xp),
                    bonusToken: String(draft.bonus_token),
                    status: draft.status,
                    sort: String(draft.sort),
                    stepIds: draft.step_ids,
                  }),
                )
              }
            >
              Kaydet
            </Button>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setDraft(null)}
            >
              Vazgeç
            </Button>
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------- liste */}
      <ul className="grid gap-2 sm:grid-cols-2">
        {chains.map((chain) => (
          <li
            key={chain.id}
            className="rounded-2xl border border-edge bg-card p-3.5"
          >
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo/15 text-indigo-ink">
                <Icon name={chain.icon ?? "list-checks"} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate">{chain.title}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  chain.status === "active"
                    ? "bg-status-success/15 text-status-success"
                    : "bg-surface text-ink-muted"
                }`}
              >
                {chain.status === "active" ? "Yayında" : "Pasif"}
              </span>
            </p>

            <p className="mt-1.5 text-xs text-ink-muted">
              {chain.step_ids.length} adım · +{chain.bonus_xp} XP · +
              {chain.bonus_token} Token
            </p>

            <div className="mt-3 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setDraft({ ...chain })}
              >
                Düzenle
              </Button>
              <Button
                variant="danger"
                size="sm"
                type="button"
                disabled={pending}
                onClick={() => run(() => deleteChainAction(chain.id))}
              >
                Sil
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {chains.length === 0 ? (
        <p className="rounded-2xl border border-edge bg-card px-4 py-6 text-center text-sm text-ink-muted">
          Henüz zincir yok. İlk zinciri oluştur.
        </p>
      ) : null}
    </div>
  );
}
