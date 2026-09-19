"use client";

import { useMemo, useState } from "react";

import { ICON_NAMES, Icon } from "@/components/ui/icon";

/**
 * İkon seçici.
 *
 * Arama, ikon adının kendisinde yapılıyor (İngilizce, lucide adları). Türkçe
 * eşanlamlı sözlüğü eklenmedi: liste zaten kırk civarında ve görsel ızgarada
 * taranabiliyor; sözlük bakımı, kazandırdığından fazla yük olurdu.
 */
export function IconPicker({
  value,
  onChange,
  label = "İkon",
}: {
  value: string;
  onChange: (name: string) => void;
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? ICON_NAMES.filter((name) => name.includes(needle)) : ICON_NAMES;
  }, [query]);

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-ink">{label}</span>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-edge bg-surface px-3 py-2 text-left text-sm text-ink"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-card text-primary-ink">
          <Icon name={value} className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate">
          {value || "İkon seç"}
        </span>
        <Icon
          name="chevron-right"
          className={`h-4 w-4 text-ink-muted transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open ? (
        <div className="mt-2 rounded-xl border border-edge bg-card p-3">
          <label className="flex items-center gap-2 rounded-lg border border-edge bg-surface px-2.5 py-1.5">
            <Icon name="search" className="h-3.5 w-3.5 text-ink-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="İkon ara (ör. tree, camera)"
              className="min-w-0 flex-1 bg-transparent text-xs text-ink outline-none placeholder:text-ink-muted"
            />
          </label>

          {filtered.length === 0 ? (
            <p className="mt-3 text-center text-xs text-ink-muted">
              Eşleşen ikon yok.
            </p>
          ) : (
            <ul className="mt-3 grid max-h-56 grid-cols-6 gap-1.5 overflow-y-auto">
              {filtered.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    title={name}
                    onClick={() => {
                      onChange(name);
                      setOpen(false);
                    }}
                    className={
                      name === value
                        ? "flex h-10 w-full items-center justify-center rounded-lg border border-primary bg-primary/10 text-primary-ink"
                        : "flex h-10 w-full items-center justify-center rounded-lg border border-edge bg-surface text-ink-muted hover:text-ink"
                    }
                  >
                    <Icon name={name} className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
