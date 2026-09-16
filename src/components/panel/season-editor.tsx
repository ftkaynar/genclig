"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  saveSeasonAction,
  settleSeasonsAction,
  type AdminSeasonRow,
} from "@/lib/seasons/admin";

const THEMES = [
  { value: "violet", label: "Mor" },
  { value: "gold", label: "Altın" },
  { value: "cyan", label: "Cyan" },
  { value: "magenta", label: "Magenta" },
  { value: "emerald", label: "Yeşil" },
  { value: "indigo", label: "İndigo" },
];

const STATUSES = [
  { value: "upcoming", label: "Yaklaşan" },
  { value: "active", label: "Aktif" },
  { value: "ended", label: "Bitti" },
];

const inputClass =
  "min-h-[40px] w-full rounded-xl border border-edge bg-surface px-3 text-sm text-ink outline-none focus:border-primary";

/** ISO damgasını datetime-local alanının beklediği biçime çevirir. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function emptySeason(): AdminSeasonRow {
  return {
    id: 0,
    name: "",
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 90 * 86_400_000).toISOString(),
    theme: "violet",
    status: "upcoming",
    badge_awarded: false,
  };
}

/*
  Sezon düzenleyici (D33 FAZ SZ).

  Silme YOK — bilerek. Bir sezon silinirse o sezonun rozetini almış
  kullanıcıların rozeti şemadan (badges cascade) uçuyor ve emekleri
  kayboluyor. Yanlış açılan sezon "Bitti" durumuna alınıp tarihleri
  geçmişe çekilerek etkisizleştiriliyor.
*/
export function SeasonEditor({ seasons }: { seasons: AdminSeasonRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<AdminSeasonRow | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function set<K extends keyof AdminSeasonRow>(
    key: K,
    value: AdminSeasonRow[K],
  ) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
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

      <div className="flex flex-wrap gap-2">
        {!draft ? (
          <Button
            variant="primary"
            size="sm"
            type="button"
            icon="sparkles"
            onClick={() => setDraft(emptySeason())}
          >
            Yeni sezon
          </Button>
        ) : null}

        <Button
          variant="secondary"
          size="sm"
          type="button"
          icon="trophy"
          disabled={pending}
          onClick={() => run(settleSeasonsAction)}
        >
          Biten sezonların rozetlerini dağıt
        </Button>
      </div>

      {draft ? (
        <section className="rounded-2xl border border-primary/50 bg-card p-4">
          <p className="mb-3 text-sm font-bold text-ink">
            {draft.id ? "Sezonu düzenle" : "Yeni sezon"}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-ink">Ad</span>
              <input
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                className={inputClass}
                placeholder="Sezon 2"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-medium text-ink">
                Başlangıç
              </span>
              <input
                type="datetime-local"
                value={toLocalInput(draft.starts_at)}
                onChange={(e) =>
                  set("starts_at", new Date(e.target.value).toISOString())
                }
                className={inputClass}
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-medium text-ink">
                Bitiş
              </span>
              <input
                type="datetime-local"
                value={toLocalInput(draft.ends_at)}
                onChange={(e) =>
                  set("ends_at", new Date(e.target.value).toISOString())
                }
                className={inputClass}
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-medium text-ink">
                Tema
              </span>
              <select
                value={draft.theme}
                onChange={(e) => set("theme", e.target.value)}
                className={inputClass}
              >
                {THEMES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
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
                {STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="mt-2 text-[11px] text-ink-muted">
            Hangi sezonun aktif olduğunu <strong>tarih aralığı</strong> belirler;
            durum alanı yalnızca bu listedeki etiket.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  saveSeasonAction({
                    id: draft.id || undefined,
                    name: draft.name,
                    startsAt: toLocalInput(draft.starts_at),
                    endsAt: toLocalInput(draft.ends_at),
                    theme: draft.theme,
                    status: draft.status,
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

      <ul className="grid gap-2 sm:grid-cols-2">
        {seasons.map((season) => (
          <li
            key={season.id}
            className="rounded-2xl border border-edge bg-card p-3.5"
          >
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              <Icon name="trophy" className="h-4 w-4 text-coin" />
              <span className="min-w-0 flex-1 truncate">{season.name}</span>
              {season.badge_awarded ? (
                <span className="shrink-0 rounded-full bg-status-success/15 px-2 py-0.5 text-[10px] font-bold text-status-success">
                  Rozet verildi
                </span>
              ) : null}
            </p>

            <p className="mt-1.5 text-xs text-ink-muted">
              {new Date(season.starts_at).toLocaleDateString("tr-TR")} —{" "}
              {new Date(season.ends_at).toLocaleDateString("tr-TR")} ·{" "}
              {season.theme}
            </p>

            <div className="mt-3">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setDraft({ ...season })}
              >
                Düzenle
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {seasons.length === 0 ? (
        <p className="rounded-2xl border border-edge bg-card px-4 py-6 text-center text-sm text-ink-muted">
          Henüz sezon yok.
        </p>
      ) : null}
    </div>
  );
}
