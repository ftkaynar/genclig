"use client";

import Image from "next/image";
import Link from "next/link";
import { useFormStatus } from "react-dom";

import { AuthBackground } from "@/components/auth/auth-background";

/*
  Kimlik ekranlarının ortak kabuğu (D35 FAZ A — baştan).

  ÖNCEKİ DURUM üç ayrı sorundan oluşuyordu:

  1. Kap `max-w-md` (448px) idi ve form kartı onu tamamen dolduruyordu;
     geniş ekranda inputlar ve butonlar orantısız uzuyordu. Artık
     `max-w-sm` (384px) — bir kimlik formunun okunabilir satır
     uzunluğu bu, daha genişi göz için tarama işine dönüyor.

  2. Arka plan marka gradyanıydı; ürünün kendi fotoğrafı varken soyut
     bir gradyan ilk izlenimi harcıyordu. Artık giris.png.

  3. Logo `logo-mark.png` idi (opak kutu). Şeffaf logo fotoğrafın
     üstünde çerçevesiz duruyor.

  Sahne tema ne olursa olsun KOYU kalıyor: giriş ekranı markanın ilk
  izlenimi, açık temada soluk bir forma dönüşmesi istenmedi.
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
    <div className="relative min-h-dvh overflow-hidden bg-brand">
      {/* Form ekranlarında fotoğraf hafif bulanık: içerik önde kalsın. */}
      <AuthBackground blur />

      <main
        className="relative z-10 mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5"
        style={{
          /*
            Güvenli alan: çentikli telefonlarda form üst çentiğin,
            alt çubukta ise jest çubuğunun altında kalıyordu.
          */
          paddingTop: "max(2.5rem, env(safe-area-inset-top))",
          paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))",
        }}
      >
        <Link href="/" className="auth-enter mx-auto mb-6 flex flex-col items-center gap-2">
          <Image
            src="/brand/transparan-logo.png"
            alt="GençLİG"
            width={72}
            height={72}
            className="auth-logo h-16 w-16"
            priority
          />
          <span className="wordmark text-xl">GençLİG</span>
        </Link>

        <section className="auth-card anim-rise rounded-3xl border border-white/15 p-6 shadow-2xl">
          <h1 className="text-lg font-bold tracking-tight text-white">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 text-sm text-white/70">{description}</p>
          ) : null}
          <div className="mt-5">{children}</div>
        </section>

        {footer ? (
          <div className="mt-5 text-center text-sm text-white/75">{footer}</div>
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
      <span className="mb-1.5 block text-sm font-medium text-white/90">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="auth-field w-full rounded-xl px-3.5 py-2.5 text-base"
      />
      {hint ? <span className="mt-1.5 block text-xs text-white/55">{hint}</span> : null}
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
      <span className="mb-1.5 block text-sm font-medium text-white/90">{label}</span>
      <select
        name={name}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="auth-field w-full rounded-xl px-3.5 py-2.5 text-base disabled:opacity-50"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={String(option.id)}>
            {option.name}
          </option>
        ))}
      </select>
      {hint ? <span className="mt-1.5 block text-xs text-white/55">{hint}</span> : null}
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
      : "border-primary/40 bg-primary/10 text-primary-ink";

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
