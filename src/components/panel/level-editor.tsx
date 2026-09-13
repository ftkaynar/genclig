"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { updateLevelAction } from "@/lib/panel/admin-actions";

/**
 * Tek seviyenin eşiğini düzenler.
 * Sıralı olma kuralı sunucuda kontrol ediliyor; buradaki tek iş değeri almak.
 */
export function LevelEditor({
  level,
  minXp,
}: {
  level: number;
  minXp: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(minXp));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setPending(true);
    try {
      const result = await updateLevelAction(level, Number(value));
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-full border border-edge px-2.5 py-1 text-[11px] font-medium text-ink-muted hover:text-ink"
      >
        Düzenle
      </button>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <input
        type="number"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-24 rounded-lg border border-edge bg-surface px-2 py-1 text-xs text-ink"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="rounded-full bg-cta px-2.5 py-1 text-[11px] font-semibold text-brand disabled:opacity-60"
      >
        {pending ? "..." : "Kaydet"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-full border border-edge px-2.5 py-1 text-[11px] text-ink-muted"
      >
        İptal
      </button>
      {error ? (
        <span role="alert" className="text-[10px] text-status-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
