"use client";

import Image from "next/image";
import Link from "next/link";
import { useFormStatus } from "react-dom";

/*
  Kimlik ekranlarının ortak kabuğu.

  Gradyan bir sahne üzerinde cam efektli (backdrop-blur) kart. Sahne sayfanın
  tamamını kaplıyor ve tema ne olursa olsun koyu kalıyor: giriş ekranı markanın
  ilk izlenimi, açık temada soluk bir forma dönüşmesi istenmedi.
*/
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
    <div className="brand-gradient relative min-h-dvh">
      {/* Gradyanı koyulaştıran örtü: form kartının kontrastı için. */}
      <div aria-hidden className="absolute inset-0 bg-brand/55" />

      <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
        <Link href="/" className="mx-auto mb-7 flex flex-col items-center gap-2.5">
          <Image
            src="/brand/logo-mark.png"
            alt="GençLİG"
            width={64}
            height={64}
            className="h-16 w-16 drop-shadow-lg"
            priority
          />
          <span className="text-2xl font-black tracking-tight text-white">
            GençLİG
          </span>
          <span className="text-xs text-white/70">
            Dijitalde başla, gerçek hayatta fark yarat.
          </span>
        </Link>

        <section className="auth-card anim-rise rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
          <h1 className="text-lg font-bold tracking-tight text-white">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 text-sm text-white/70">{description}</p>
          ) : null}
          <div className="mt-5">{children}</div>
        </section>

        {footer ? (
          <div className="mt-5 text-center text-sm text-white/70">{footer}</div>
        ) : null}
      </main>
    </div>
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
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  /** Mobilde doğru klavyeyi açmak için (telefon alanında "numeric"). */
  inputMode?: "text" | "numeric" | "tel" | "email";
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
        inputMode={inputMode}
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
      className="w-full rounded-full btn-chunky bg-cta px-6 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
