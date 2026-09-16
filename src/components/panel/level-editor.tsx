"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
      <Button variant="secondary" size="sm" type="button" onClick={() => setOpen(true)}>
        Düzenle
      </Button>
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
        className="rounded-full btn-chunky bg-cta px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
      >
        {pending ? "..." : "Kaydet"}
      </button>
      <Button variant="secondary" size="sm" type="button" onClick={() => setOpen(false)}>
        İptal
      </Button>
      {error ? (
        <span role="alert" className="text-[10px] text-status-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
