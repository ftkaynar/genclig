"use client";

import { Icon } from "@/components/ui/icon";

import { useTheme } from "./theme-provider";

/**
 * Tema değiştirme butonu.
 *
 * İkon ve erişilebilir ad React state'ine değil CSS'e bağlı (when-dark /
 * when-light sınıfları, bkz. globals.css). Neden: sunucu HTML'i her zaman tek
 * bir temayla üretiliyor; hangi ikonun görüneceğini state'ten okusaydık
 * kullanıcının tercihi farklı olduğunda hydration uyuşmazlığı çıkardı.
 * `display: none` olan içerik erişilebilirlik ağacına da girmediği için
 * ekran okuyucu her zaman yalnızca geçerli metni duyuyor.
 *
 * Görünüm bildirim çanıyla aynı: 36px yuvarlak, kenarlı. Önceden metin
 * ("Açık tema" / "Koyu tema") taşıyan bir hap idi; üst barda çanın yanında
 * tek metin buton olarak duruyordu ve dar ekranda satırı zorluyordu.
 */
export function ThemeToggle() {
  const { toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-edge bg-card text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
    >
      {/* Koyu temadayken güneş görünüyor: tıklayınca açık temaya geçilecek. */}
      <span className="when-dark">
        <Icon name="sun" className="h-4 w-4" />
      </span>
      <span className="when-light">
        <Icon name="moon" className="h-4 w-4" />
      </span>

      <span className="when-dark sr-only">Açık temaya geç</span>
      <span className="when-light sr-only">Koyu temaya geç</span>
    </button>
  );
}
