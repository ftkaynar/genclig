"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { setTaskStatusAction } from "@/lib/panel/actions";

const OPTIONS = [
  { value: "draft", label: "Taslak" },
  { value: "active", label: "Yayınla" },
  { value: "paused", label: "Duraklat" },
  { value: "archived", label: "Arşivle" },
];

/** Görev durumunu değiştiren düğme dizisi. Yetki RLS ile sınırlı. */
export function TaskStatusControls({
  taskId,
  current,
}: {
  taskId: string;
  current: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(status: string) {
    setError(null);
    setPending(true);
    try {
      const result = await setTaskStatusAction(taskId, status);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3">
      {error ? (
        <p role="alert" className="mb-2 text-xs text-status-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {OPTIONS.filter((option) => option.value !== current).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => apply(option.value)}
            disabled={pending}
            className="rounded-full border border-edge px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink disabled:opacity-60"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
