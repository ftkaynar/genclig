/*
  Hedef renk kimliği (D32 FAZ B2).

  ÖNCEKİ DURUM: her ekranın kısayolu kendi rengini seçiyordu. Ana
  sayfada Takım magenta, profilde aynı Takım mor gradyandı; Arkadaşlar
  bir yerde mor bir yerde cyan. Renk hiçbir şey SÖYLEMİYORDU — süs
  olarak duruyordu ve kullanıcı ızgarada aradığı kutucuğu her seferinde
  okuyarak buluyordu.

  v2'de her hedefin TEK rengi var ve o renk hedefe ait: aynı renk hem
  butonda, hem ikon chip'inde, hem kısayol kutucuğunda. Kullanıcı ikinci
  kullanımdan sonra "altın olan Ödüller" diye hatırlıyor, okumuyor.

  Renkler paletten (globals.css @theme): coin/altın, primary/mor,
  cyan, magenta, status-success/yeşil, indigo. Yeni renk EKLENMEDİ —
  yedi ayrı kimlik için yeni ton üretmek paleti sulandırırdı.

  Sınıf adları TAM METİN: Tailwind kaynağı tarayarak sınıf üretiyor,
  `bg-${tone}/15` gibi kurulmuş bir ad derlemeye hiç girmiyor (aynı kural
  lib/tasks/labels.ts ve components/ui/button.tsx için de geçerli).
*/

import type { ButtonVariant } from "@/components/ui/button";

export type AccentKey =
  | "gold"
  | "violet"
  | "cyan"
  | "magenta"
  | "emerald"
  | "indigo";

/** İkon chip'i: soluk dolgu + tam kontrastlı ikon. */
export const ACCENT_CHIP: Record<AccentKey, string> = {
  gold: "bg-coin/15 text-coin",
  violet: "bg-primary/15 text-primary",
  cyan: "bg-cyan/15 text-cyan",
  magenta: "bg-magenta/15 text-magenta",
  emerald: "bg-status-success/15 text-status-success",
  indigo: "bg-indigo/15 text-indigo",
};

/** Kutucuğun hover/odak kenarı — chip rengiyle aynı aile. */
export const ACCENT_EDGE: Record<AccentKey, string> = {
  gold: "hover:border-coin/60",
  violet: "hover:border-primary/60",
  cyan: "hover:border-cyan/60",
  magenta: "hover:border-magenta/60",
  emerald: "hover:border-status-success/60",
  indigo: "hover:border-indigo/60",
};

/** Aynı kimliğin dolu buton karşılığı. */
export const ACCENT_BUTTON: Record<AccentKey, ButtonVariant> = {
  gold: "gold",
  violet: "primary",
  cyan: "cyan",
  magenta: "magenta",
  emerald: "emerald",
  indigo: "indigo",
};

/*
  Hedef -> kimlik.

  Anahtar rota yolu: kimlik EKRANA ait, onu açan düğmeye değil. Aynı
  ekrana üç yerden gidiliyor (ana sayfa ızgarası, profil ızgarası, alt
  gezinme) ve üçünün de aynı rengi göstermesi gerekiyor.
*/
export const DESTINATION_ACCENT: Record<string, AccentKey> = {
  "/oduller": "gold",
  "/takim": "violet",
  "/arkadaslar": "cyan",
  "/topluluk": "magenta",
  "/destek": "emerald",
  "/gorevler": "indigo",
  "/gorevlerim": "indigo",
};

/** Bilinmeyen hedefte mor: markanın varsayılan aksanı. */
export function accentFor(href: string): AccentKey {
  return DESTINATION_ACCENT[href] ?? "violet";
}
