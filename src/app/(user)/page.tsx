import Image from "next/image";

import { ThemeToggle } from "@/components/theme-toggle";

// Kullanıcı PWA ana ekranı. Route group "(user)" URL'e yansımaz, "/" olarak servis edilir.
// Neden route group: /panel ve /admin'den ayrı bir layout'a geçebilmek için.
// Bu dilimde içerik placeholder; görev, puan ve coin akışları sonraki dilimlerde.

const BOTTOM_NAV = [
  "Ana Sayfa",
  "Görevler",
  "Keşfet",
  "Sıralama",
  "Profil",
] as const;

export default function UserHomePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <div className="flex justify-end px-4 pt-4">
        <ThemeToggle />
      </div>

      {/*
        Marka gradyanı tek bir imza alanında kullanılıyor. Tüm sayfayı
        gradyanla kaplamak, tema açığa alındığında okunabilirliği bozuyordu.
      */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <section className="brand-gradient w-full rounded-3xl px-6 py-10 text-center shadow-lg">
          <Image
            src="/brand/logo-mark.png"
            alt="GençLİG logosu"
            width={96}
            height={96}
            className="mx-auto h-24 w-24"
            priority
          />
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-white">
            GençLİG
          </h1>
          <p className="mt-2 text-sm text-white/80">
            Şehrinde görev yap, puan kazan.
          </p>

          {/* href yok: akış henüz bağlanmadı, buton bilerek devre dışı. */}
          <button
            type="button"
            disabled
            className="mt-7 w-full rounded-full bg-cta px-6 py-3 text-base font-semibold text-brand disabled:cursor-not-allowed disabled:opacity-60"
          >
            Hemen başla
          </button>
        </section>
      </main>

      <nav
        aria-label="Ana gezinme"
        className="sticky bottom-0 border-t border-edge bg-card"
      >
        <ul className="flex items-stretch justify-between px-2 py-2">
          {BOTTOM_NAV.map((label, index) => (
            <li key={label} className="flex-1">
              <span
                aria-current={index === 0 ? "page" : undefined}
                className={
                  index === 0
                    ? "block rounded-lg px-1 py-2 text-center text-[11px] font-semibold text-primary"
                    : "block rounded-lg px-1 py-2 text-center text-[11px] font-medium text-ink-muted"
                }
              >
                {label}
              </span>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
