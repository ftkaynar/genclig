"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AdminActionState } from "@/lib/panel/admin-actions";

export type FieldSpec = {
  name: string;
  label: string;
  type?: "text" | "number" | "textarea" | "select";
  options?: { value: string; label: string }[];
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
};

/**
 * Yönetim ekranlarının ortak satır içi düzenleyicisi.
 *
 * Her kayıt tipi için ayrı form bileşeni yazmak yerine alan tanımlarıyla
 * çalışan tek bir düzenleyici kullanıldı: admin ekranlarının hepsi aynı
 * kalıpta (birkaç alan + kaydet) ve tekrar eden altı forma bölmek bakım
 * yükünü artırıyordu.
 */
export function InlineEditor({
  title,
  fields,
  submitLabel = "Kaydet",
  onSubmit,
}: {
  title: string;
  fields: FieldSpec[];
  submitLabel?: string;
  onSubmit: (values: Record<string, string>) => Promise<AdminActionState>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((field) => [field.name, field.defaultValue ?? ""]),
    ),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const result = await onSubmit(values);
      if (result.error) {
        setError(result.error);
        return;
      }
      setNotice(result.notice ?? "Kaydedildi.");
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
        className="rounded-full border border-edge bg-card px-3.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
      >
        {title}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-edge bg-card p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-status-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-2 text-xs text-primary">
          {notice}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-3">
        {fields.map((field) => (
          <label key={field.name} className="block">
            <span className="mb-1 block text-xs font-medium text-ink">
              {field.label}
            </span>

            {field.type === "textarea" ? (
              <textarea
                rows={3}
                value={values[field.name] ?? ""}
                placeholder={field.placeholder}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    [field.name]: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-edge bg-surface px-3 py-2 text-sm text-ink"
              />
            ) : field.type === "select" ? (
              <select
                value={values[field.name] ?? ""}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    [field.name]: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-edge bg-surface px-3 py-2 text-sm text-ink"
              >
                <option value="">Seç</option>
                {(field.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type === "number" ? "number" : "text"}
                value={values[field.name] ?? ""}
                placeholder={field.placeholder}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    [field.name]: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-edge bg-surface px-3 py-2 text-sm text-ink"
              />
            )}

            {field.hint ? (
              <span className="mt-1 block text-[11px] text-ink-muted">
                {field.hint}
              </span>
            ) : null}
          </label>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="flex-1 rounded-full bg-cta px-4 py-2 text-sm font-semibold text-brand disabled:opacity-60"
        >
          {pending ? "Kaydediliyor..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-full border border-edge px-4 py-2 text-sm font-medium text-ink-muted"
        >
          Kapat
        </button>
      </div>
    </div>
  );
}
