"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Icon } from "@/components/ui/icon";
import type { ProvinceChannel } from "@/lib/community/queries";

/*
  İl seçici (D32 FAZ KE).

  Kullanıcı artık istediği ilin kanalına girip okuyabiliyor ve
  yazabiliyor. Varsayılan kendi ili; seçim URL'de taşınıyor (?il=<id>)
  çünkü sohbet sunucuda render ediliyor ve seçim paylaşılabilir /
  geri tuşuyla çalışır olmalı.

  Arama kutusu 81 il için şart: kaydırmalı bir listede il bulmak
  telefonda uzun sürüyordu. Türkçe karakter duyarsız karşılaştırma —
  "istanbul" yazan kullanıcı "İstanbul"u bulmalı.
*/

/** Türkçe'ye duyarlı, aksansız karşılaştırma anahtarı. */
function foldTr(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c");
}

export function ProvincePicker({
  channels,
  currentId,
  currentName,
}: {
  channels: ProvinceChannel[];
  currentId: string;
  currentName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = foldTr(query.trim());
    if (!q) return channels;
    return channels.filter((c) => foldTr(c.province_name).includes(q));
  }, [channels, query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press-soft flex min-h-[40px] w-full items-center gap-2 rounded-xl border border-edge bg-card px-3 text-left"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary-ink">
          <Icon name="map-pin" className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold text-ink">
            {currentName}
          </span>
        </span>
        <span className="shrink-0 text-[11px] font-semibold text-primary-ink">
          Değiştir
        </span>
        <Icon
          name="chevron-right"
          className="h-4 w-4 shrink-0 text-ink-muted"
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="İl seç"
          className="fixed inset-0 z-50 flex flex-col bg-brand/85 backdrop-blur-sm"
        >
          <div className="anim-rise mx-auto flex h-full w-full max-w-md flex-col bg-surface">
            <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
              <label className="flex min-h-[40px] flex-1 items-center gap-2 rounded-xl border border-edge bg-card px-3">
                <Icon
                  name="search"
                  className="h-4 w-4 shrink-0 text-ink-muted"
                />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="İl ara"
                  className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
                />
              </label>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Kapat"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-edge text-ink-muted"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>

            <ul className="min-h-0 flex-1 overflow-y-auto p-3">
              {filtered.map((channel) => {
                const isCurrent = channel.channel_id === currentId;
                return (
                  <li key={channel.channel_id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        router.push(`/topluluk?il=${channel.province_id}`);
                      }}
                      className={`press-soft flex min-h-[48px] w-full items-center gap-2 rounded-xl px-3 text-left text-sm ${
                        isCurrent
                          ? "bg-primary/15 font-bold text-primary-ink"
                          : "font-medium text-ink hover:bg-card"
                      }`}
                    >
                      {channel.province_name}
                      {isCurrent ? (
                        <Icon name="check" className="ml-auto h-4 w-4" />
                      ) : null}
                    </button>
                  </li>
                );
              })}

              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-ink-muted">
                  Eşleşen il yok.
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
