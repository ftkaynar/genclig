import Link from "next/link";

import { AppHeader } from "@/components/app-header";

/** Panel ve admin ekranlarının ortak gezinme çerçevesi. */
export function PanelShell({
  title,
  subtitle,
  nav,
  children,
}: {
  title: string;
  subtitle?: string;
  nav: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <AppHeader title={title} />

      <div className="mx-auto w-full max-w-5xl px-4 pt-4">
        {subtitle ? (
          <p className="text-sm text-ink-muted">{subtitle}</p>
        ) : null}

        <nav aria-label="Panel gezinme" className="mt-3">
          <ul className="flex flex-wrap gap-2">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-full border border-edge bg-card inline-flex min-h-[40px] items-center px-3.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        {children}
      </main>
    </div>
  );
}

/** Yetkisi olmayan kullanıcıya gösterilen açıklayıcı ekran. */
export function NoAccess({
  title = "Bu alana erişimin yok",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <AppHeader title="GençLİG" />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
        <section className="rounded-2xl border border-edge bg-card p-6 text-center">
          <h1 className="text-lg font-semibold text-ink">{title}</h1>
          <p className="mt-2 text-sm text-ink-muted">{message}</p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-full btn-chunky bg-cta px-5 py-2.5 text-sm font-semibold text-white"
          >
            Ana sayfaya dön
          </Link>
        </section>
      </main>
    </div>
  );
}

/** Panel gösterge kartı. */
export function KpiCard({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: number | string;
  tone?: "ink" | "primary" | "warning" | "danger";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "warning"
        ? "text-status-warning"
        : tone === "danger"
          ? "text-status-danger"
          : "text-ink";

  return (
    <div className="rounded-2xl border border-edge bg-card p-4">
      <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs text-ink-muted">{label}</p>
    </div>
  );
}
