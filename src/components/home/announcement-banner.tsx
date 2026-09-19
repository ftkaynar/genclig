"use client";

import { useCallback, useSyncExternalStore } from "react";

import { Icon } from "@/components/ui/icon";
import type { LatestAnnouncement } from "@/lib/announcements/labels";

const STORAGE_KEY = "genclig:dismissed-announcement";

/*
  Kapatılan duyurunun kimliği `localStorage`da tutuluyor, veritabanında
  değil: duyuruyu kapatmak kişisel ve önemsiz bir tercih, bunun için her
  kullanıcıya satır açmak ve her ana sayfa yüklemesinde bir sorgu daha
  atmak gereksizdi. Cihaz başına unutulması kabul edilebilir bir maliyet.

  Okuma `useSyncExternalStore` ile yapılıyor. Denenen ve elenen alternatif:
  `useEffect` içinde `setState`. Elendi, çünkü lint `set-state-in-effect`
  hatası veriyor (aynı kurala D05'te de takılmıştık) ve haklı — efektle
  state yazmak fazladan bir render turu demek. `useSyncExternalStore`
  sunucu anlık görüntüsünü ayrıca alabildiği için SSR'da da doğru çalışıyor.
*/

function subscribe(onChange: () => void) {
  // Başka sekmede kapatılırsa burada da kapansın.
  window.addEventListener("storage", onChange);
  window.addEventListener(STORAGE_KEY, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(STORAGE_KEY, onChange);
  };
}

function readDismissed(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // Gizli sekme ya da depolama kapalı: hiçbir şey kapatılmamış say.
    return null;
  }
}

/** Sunucuda depolama yok; afiş ilk boyamada görünür. */
function serverSnapshot(): string | null {
  return null;
}

export function AnnouncementBanner({
  announcement,
}: {
  announcement: LatestAnnouncement;
}) {
  const dismissedId = useSyncExternalStore(
    subscribe,
    readDismissed,
    serverSnapshot,
  );

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, announcement.id);
    } catch {
      // Depolama yoksa kapatma kalıcı olmuyor; afiş yenilemede geri gelir.
    }
    window.dispatchEvent(new Event(STORAGE_KEY));
  }, [announcement.id]);

  if (dismissedId === announcement.id) return null;

  return (
    <section className="brand-gradient anim-pop mt-3 rounded-2xl p-[2px]">
      <div className="flex items-start gap-3 rounded-[calc(1rem-2px)] bg-card p-3.5">
        <span className="brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white">
          <Icon name="megaphone" className="h-4.5 w-4.5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-primary-ink">
            Duyuru
          </span>
          <span className="mt-0.5 block text-sm font-semibold text-ink">
            {announcement.title}
          </span>
          {announcement.body ? (
            <span className="mt-0.5 line-clamp-2 block text-xs text-ink-muted">
              {announcement.body}
            </span>
          ) : null}
        </span>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Duyuruyu kapat"
          className="shrink-0 rounded-full p-1 text-ink-muted transition-colors hover:text-ink"
        >
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
