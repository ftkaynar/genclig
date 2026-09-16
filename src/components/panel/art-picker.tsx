"use client";

import { Icon } from "@/components/ui/icon";
import { TASK_ART_HINTS, TASK_ART_KEYS, taskArtUrl } from "@/lib/tasks/art";

/**
 * Görev kapak görseli seçici (D32 FAZ G3).
 *
 * Arama kutusu YOK: yirmi görsel tek ekrana sığıyor ve hepsi görselle
 * ayrışıyor. İkon seçicideki arama kutusu oradaki kırk küsur ikon adı
 * için gerekliydi; burada aynı kutu, taranabilir bir ızgaranın önüne
 * gereksiz bir adım koyardı.
 *
 * Görseller <img> değil arka plan: kart üzerinde de aynı şekilde
 * basılıyor, seçicideki önizleme kartta göreceğiyle birebir aynı olmalı.
 */
export function ArtPicker({
  value,
  onChange,
  label = "Kapak görseli",
}: {
  value: string;
  onChange: (key: string) => void;
  label?: string;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-ink">{label}</span>

      <div className="rounded-xl border border-edge bg-card p-3">
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
          {/* "Görsel yok" ilk kutu: varsayılanı seçmek de bir seçim. */}
          <button
            type="button"
            onClick={() => onChange("")}
            aria-pressed={value === ""}
            title="Görsel yok — kategori gradyanı"
            className={`flex aspect-[3/4] items-center justify-center rounded-lg border-2 bg-surface ${
              value === "" ? "border-primary" : "border-edge"
            }`}
          >
            <Icon name="x" className="h-4 w-4 text-ink-muted" />
          </button>

          {TASK_ART_KEYS.map((key) => {
            const url = taskArtUrl(key);
            const isActive = value === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange(key)}
                aria-pressed={isActive}
                title={`${key} · ${TASK_ART_HINTS[key] ?? ""}`}
                className={`relative aspect-[3/4] overflow-hidden rounded-lg border-2 bg-cover bg-center ${
                  isActive ? "border-primary" : "border-transparent"
                }`}
                style={url ? { backgroundImage: `url(${url})` } : undefined}
              >
                {isActive ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-brand/40">
                    <Icon name="check" className="h-4 w-4 text-white" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="mt-2 text-[11px] text-ink-muted">
          {value
            ? `${value} · ${TASK_ART_HINTS[value] ?? ""}`
            : "Görsel seçilmezse kart kategori gradyanını kullanır."}
        </p>
      </div>
    </div>
  );
}
