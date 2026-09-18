import Image from "next/image";

import { ThemeToggle } from "./theme-toggle";

/**
 * Yönetim yüzlerinin (panel, admin) ortak başlığı.
 * Kullanıcı PWA'sı kendi düzenini kurduğu için bu bileşeni kullanmaz.
 */
export function AppHeader({ title }: { title: string }) {
  return (
    <header className="border-b border-edge bg-card">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Image
            src="/brand/transparan-logo.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7"
            priority
          />
          <span className="text-sm font-semibold tracking-tight text-ink">
            {title}
          </span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
