"use client";

import { useMemo, useState } from "react";

import { Icon } from "@/components/ui/icon";
import {
  TASK_ART_HINTS,
  TASK_ART_KEYS,
  taskArtUrl,
  taskCoverUrl,
} from "@/lib/tasks/art";

/**
 * Görev kapak görseli seçici (D32 FAZ G3, D40'ta galeriye çevrildi).
 *
 * D40'TA NE DEĞİŞTİ:
 *
 *   Görsel sayısı 20'den 40'a çıktı ve her anahtar artık bir ÇİFT:
 *   kart kapağı (yatay sahne) + detay kapağı (geniş şerit). Seçici
 *   bunu yansıtıyor — tek seçim iki görseli birden belirliyor ve
 *   seçilen çift altta birlikte önizleniyor.
 *
 *   Arama kutusu EKLENDİ. Önceki sürümde "yirmi görsel tek ekrana
 *   sığıyor, arama gereksiz bir adım" yazıyordu; bu artık doğru değil.
 *   Kırk yatay küçük resim tek ekrana sığmıyor, ızgara kaydırmalı ve
 *   aranmadan taranması gereken liste iki katına çıktı.
 *
 *   Oran 3:4'ten 16:10'a döndü: parçaların kendisi yatay (ölçülen
 *   oran 1.49-2.07). Dikey kutuya basmak önizlemeyi kartta
 *   görülecekten farklı gösteriyordu.
 *
 * Görseller <img> değil arka plan: kart üzerinde de aynı şekilde
 * basılıyor, seçicideki önizleme kartta göreceğiyle birebir aynı olmalı.
 */

/** Türkçe'ye duyarlı, aksan/büyük-küçük farkını yutan arama anahtarı. */
function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .replaceAll("ş", "s")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replaceAll("â", "a");
}

export function ArtPicker({
  value,
  onChange,
  label = "Kapak görseli",
}: {
  value: string;
  onChange: (key: string) => void;
  label?: string;
}) {
  const [sorgu, setSorgu] = useState("");

  const gorunen = useMemo(() => {
    const q = normalize(sorgu.trim());
    if (!q) return TASK_ART_KEYS;
    /*
      Hem anahtar hem ipucu taranıyor: yönetici "art-12" diye de
      arayabiliyor, "fidan" diye de. Tek alanda arama, iki ayrı
      filtreden (kategori açılır listesi + metin) daha az tıklama.
    */
    return TASK_ART_KEYS.filter(
      (k) => normalize(k).includes(q) || normalize(TASK_ART_HINTS[k] ?? "").includes(q),
    );
  }, [sorgu]);

  const seciliKart = taskArtUrl(value);
  const seciliKapak = taskCoverUrl(value);

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-ink">{label}</span>

      <div className="rounded-xl border border-edge bg-card p-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
            />
            <input
              type="search"
              value={sorgu}
              onChange={(e) => setSorgu(e.target.value)}
              placeholder="Görsel ara — fidan, müze, koşu, art-12…"
              className="h-9 w-full rounded-lg border border-edge bg-surface pl-8 pr-2 text-xs text-ink placeholder:text-ink-muted"
            />
          </div>
          <span className="shrink-0 text-[11px] tabular-nums text-ink-muted">
            {gorunen.length}/{TASK_ART_KEYS.length}
          </span>
        </div>

        {/*
          Kaydırmalı ızgara. Yükseklik sınırı VAR: kırk küçük resim
          sınırsız uzasa, altındaki "Kaydet" düğmesi iki ekran aşağı
          düşüyordu ve form kullanılamaz hale geliyordu.
        */}
        <div className="max-h-[280px] overflow-y-auto rounded-lg">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {/* "Görsel yok" ilk kutu: varsayılanı seçmek de bir seçim. */}
            {sorgu.trim() ? null : (
              <button
                type="button"
                onClick={() => onChange("")}
                aria-pressed={value === ""}
                title="Görsel yok — kategori gradyanı"
                className={`flex aspect-[16/10] items-center justify-center rounded-lg border-2 bg-surface ${
                  value === "" ? "border-primary" : "border-edge"
                }`}
              >
                <Icon name="x" className="h-4 w-4 text-ink-muted" />
              </button>
            )}

            {gorunen.map((key) => {
              const url = taskArtUrl(key);
              const isActive = value === key;
              const ipucu = TASK_ART_HINTS[key] ?? "";
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange(key)}
                  aria-pressed={isActive}
                  title={`${key} · ${ipucu}`}
                  className={`relative aspect-[16/10] overflow-hidden rounded-lg border-2 bg-cover bg-center ${
                    isActive ? "border-primary" : "border-transparent"
                  }`}
                  style={url ? { backgroundImage: `url(${url})` } : undefined}
                >
                  {isActive ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-brand/40">
                      <Icon name="check" className="h-4 w-4 text-white" />
                    </span>
                  ) : null}
                  {/*
                    İpucu küçük resmin ÜSTÜNDE, altında değil: alt satır
                    ızgarayı kırk satır boyunca uzatıyordu. Perde sayesinde
                    her fotoğrafta okunuyor.
                  */}
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-left text-[9px] leading-tight text-white">
                    {ipucu || key}
                  </span>
                </button>
              );
            })}
          </div>

          {gorunen.length === 0 ? (
            <p className="px-1 py-6 text-center text-[11px] text-ink-muted">
              “{sorgu}” için görsel yok.
            </p>
          ) : null}
        </div>

        {/*
          Seçilen çiftin önizlemesi. İKİSİ BİRDEN gösteriliyor çünkü tek
          seçim iki ayrı yerde çiziliyor: sahne kartta, şerit detay
          sayfasının en üstünde. Yalnız kartı göstermek, yöneticinin
          detay kapağını hiç görmeden kaydetmesi demekti.
        */}
        {value && seciliKart && seciliKapak ? (
          <div className="mt-3 rounded-lg border border-edge bg-surface p-2">
            <p className="mb-1.5 text-[11px] font-medium text-ink">
              {value} · {TASK_ART_HINTS[value] ?? ""}
            </p>
            {/*
              Genişlikler EŞİT DEĞİL, çünkü oranlar eşit değil: kart
              16/10, detay 29/10. Yarı yarıya bölünce kart iki kat uzun
              düşüyor ve detayın yanında boşluk kalıyordu. %36/%64,
              w/1.6 = w/2.9 denkleminin çözümü — iki önizleme aynı
              yükseklikte duruyor.
            */}
            <div className="flex items-end gap-2">
              <div className="w-[36%]">
                <span className="mb-1 block text-[10px] text-ink-muted">Kart</span>
                <span
                  className="block aspect-[16/10] rounded-md bg-cover bg-center"
                  style={{ backgroundImage: `url(${seciliKart})` }}
                />
              </div>
              <div className="flex-1">
                <span className="mb-1 block text-[10px] text-ink-muted">Detay</span>
                <span
                  className="block aspect-[29/10] rounded-md bg-cover bg-center"
                  style={{ backgroundImage: `url(${seciliKapak})` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-ink-muted">
            Görsel seçilmezse kart kategori gradyanını kullanır.
          </p>
        )}
      </div>
    </div>
  );
}
