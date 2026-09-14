"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/icon";

/*
  Sayfa içi kısa bildirim.

  Rozet kazanımı gibi "hemen gör, sonra unut" olaylar için. Bildirim listesine
  de düşüyor; buradaki amaç kullanıcı o an ekrandayken kaçırmaması.

  Dört saniye sonra kendini kapatıyor. Kuyruk yok: aynı anda birden fazla
  toast gösterilmesi gereken bir akış henüz yok, kuyruk eklemek kullanılmayan
  karmaşıklık olurdu.
*/
export function Toast({
  icon = "award",
  title,
  description,
  durationMs = 4000,
  onDone,
}: {
  icon?: string;
  title: string;
  description?: string;
  durationMs?: number;
  onDone?: () => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [durationMs, onDone]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="anim-rise fixed inset-x-4 bottom-20 z-40 mx-auto max-w-sm rounded-2xl border border-primary/40 bg-card/95 p-3.5 shadow-xl backdrop-blur"
    >
      <div className="flex items-center gap-3">
        <span className="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white">
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">
            {title}
          </span>
          {description ? (
            <span className="block truncate text-xs text-ink-muted">
              {description}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
