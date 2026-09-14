/*
  Harita işaretçilerinin kategori ikonları.

  Leaflet'in divIcon'u HTML metni alıyor, React bileşeni değil; Icon
  bileşenini doğrudan kullanmanın yolu yok.

  Denenen ve elenen alternatifler:
  - `react-dom/server`in `renderToStaticMarkup`ını client tarafında çağırmak:
    sunucu render kütüphanesini tarayıcı paketine sokuyordu.
  - Paketten ikon düğümlerini çalışma anında okumak: lucide-react ikonları
    React bileşeni olarak dışa veriyor, ham yol verisi erişilebilir değil.

  Bu yüzden altı kategori ikonunun yol verisi lucide-react'ten bir kez
  çıkarılıp buraya sabit olarak alındı. lucide sürümü yükseltilirse bu
  yolların da yenilenmesi gerekiyor; ikon kümesinin geri kalanı
  `src/components/ui/icon.tsx` üzerinden paketten geliyor, yalnızca harita
  işaretçileri bu kopyayı kullanıyor.
*/

export type CategoryPin = {
  color: string;
  paths: string;
};

const LEAF =
  '<path d="M11 20a10 10 0 0010-10 25.9 25.9 0 00-1.04-7.281 1 1 0 00-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0011 20"/><path d="M2 21a5 5 0 012.911-4.544C7.613 15.212 8.351 15.24 11 13"/>';

const USERS =
  '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>';

const ACTIVITY =
  '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>';

const LANDMARK =
  '<path d="M10 18v-7"/><path d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>';

const GRADUATION_CAP =
  '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>';

const MEGAPHONE =
  '<path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/><path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14"/><path d="M8 6v8"/>';

const TARGET =
  '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>';

/** Kategori slug'ı → palet v2 rengi + ikon yolu. */
export const CATEGORY_PIN: Record<string, CategoryPin> = {
  environment: { color: "#22c55e", paths: LEAF },
  social: { color: "#7c3aed", paths: USERS },
  sports: { color: "#ec4899", paths: ACTIVITY },
  culture: { color: "#6366f1", paths: LANDMARK },
  education: { color: "#f59e0b", paths: GRADUATION_CAP },
  civic: { color: "#22d3ee", paths: MEGAPHONE },
};

export const CATEGORY_PIN_FALLBACK: CategoryPin = {
  color: "#6366f1",
  paths: TARGET,
};

/** Kategori çipi: renkli yuvarlak, içinde beyaz ikon, altında sivri uç. */
export function pinMarkup(pin: CategoryPin): string {
  return [
    `<span style="display:block;position:relative;width:32px;height:38px">`,
    `<span style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:0;height:0;`,
    `border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${pin.color}"></span>`,
    `<span style="position:absolute;top:0;left:0;display:flex;align-items:center;justify-content:center;`,
    `width:32px;height:32px;border-radius:9999px;background:${pin.color};border:2px solid #fff;`,
    `box-shadow:0 2px 6px rgba(0,0,0,.35)">`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" `,
    `stroke="#fff" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${pin.paths}</svg>`,
    `</span></span>`,
  ].join("");
}
