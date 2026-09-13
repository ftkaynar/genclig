"use client";

import { useTheme } from "./theme-provider";

/**
 * Tema değiştirme butonu.
 *
 * Etiket metni React state'ine değil CSS'e bağlı (when-dark / when-light
 * sınıfları, bkz. globals.css). Neden: sunucu HTML'i her zaman tek bir temayla
 * üretiliyor; etiketi state'ten okusaydık kullanıcının tercihi farklı olduğunda
 * hydration uyuşmazlığı çıkardı.
 */
export function ThemeToggle() {
  const { toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Temayı değiştir"
      className="rounded-full border border-edge bg-card px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
    >
      <span className="when-dark">Açık tema</span>
      <span className="when-light">Koyu tema</span>
    </button>
  );
}
