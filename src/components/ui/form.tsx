"use client";

import Image from "next/image";
import Link from "next/link";
import { useFormStatus } from "react-dom";

/** Kimlik ekranlarının ortak kabuğu: marka başlığı + kart. */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mx-auto mb-6 flex flex-col items-center gap-2">
        <Image
          src="/brand/logo-mark.png"
          alt="GençLİG"
          width={56}
          height={56}
          className="h-14 w-14"
          priority
        />
        <span className="text-xl font-bold tracking-tight text-ink">
          GençLİG
        </span>
      </Link>

      <section className="rounded-3xl border border-edge bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight text-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-sm text-ink-muted">{description}</p>
        ) : null}
        <div className="mt-5">{children}</div>
      </section>

      {footer ? (
        <div className="mt-5 text-center text-sm text-ink-muted">{footer}</div>
      ) : null}
    </main>
  );
}

export function TextField({
  label,
  name,
  type = "text",
  autoComplete,
  placeholder,
  defaultValue,
  hint,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  defaultValue?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-ink-muted/70 focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
      />
      {hint ? <span className="mt-1.5 block text-xs text-ink-muted">{hint}</span> : null}
    </label>
  );
}

export function SelectField({
  label,
  name,
  value,
  onChange,
  disabled,
  placeholder,
  options,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder: string;
  options: { id: number | string; name: string }[];
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <select
        name={name}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-base text-ink disabled:opacity-50 focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={String(option.id)}>
            {option.name}
          </option>
        ))}
      </select>
      {hint ? <span className="mt-1.5 block text-xs text-ink-muted">{hint}</span> : null}
    </label>
  );
}

export function FormAlert({
  kind = "error",
  children,
}: {
  kind?: "error" | "info";
  children: React.ReactNode;
}) {
  const tone =
    kind === "error"
      ? "border-status-danger/40 bg-status-danger/10 text-status-danger"
      : "border-primary/40 bg-primary/10 text-primary";

  return (
    <p role="alert" className={`rounded-xl border px-3.5 py-2.5 text-sm ${tone}`}>
      {children}
    </p>
  );
}

/**
 * Gönder butonu. Bekleme durumunu useFormStatus'tan okur; böylece her form
 * ayrıca "gönderiliyor mu" state'i tutmak zorunda kalmıyor.
 */
export function SubmitButton({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-cta px-6 py-3 text-base font-semibold text-brand transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
