import { createClient } from "@/lib/supabase/server";
import {
  isKnownMissing,
  isMissingSchema,
  markMissing,
} from "@/lib/supabase/schema-guard";
import type { AccentKey } from "@/lib/ui/accents";

/*
  Sezonlar (D33 FAZ SZ).

  Sezon = dönemsel bir tema. Şu an iki şey yapıyor: FUT kartın köşesinde
  ince bir etiket ve sıralama başlığında bir ibare.

  Sezon bazlı sıralama dönemi ve sezon sonu büyük ödülleri SONRAKİ İŞ
  (rapora borç olarak yazıldı). Bu dilimde sezon bir çerçeve; puan
  ekonomisine dokunmuyor.

  Şema geride kalırsa null dönüyor ve etiket hiç çizilmiyor — D32'de
  ölçtüğümüz kesintiyi tekrarlamamak için.
*/

const SEASON_RPC = "active_season";

export type Season = {
  id: number;
  name: string;
  theme: string;
  starts_at: string;
  ends_at: string;
};

export async function getActiveSeason(): Promise<Season | null> {
  if (isKnownMissing(SEASON_RPC)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("active_season");

  if (error) {
    if (isMissingSchema(error)) markMissing(SEASON_RPC);
    return null;
  }

  const rows = (data ?? []) as Season[];
  return rows[0] ?? null;
}

/*
  Sezon teması -> aksan anahtarı.

  DB'de serbest metin var; arayüz yalnız bilinen aksanları kabul
  ediyor. Tanınmayan tema mor'a düşüyor: yönetici yazım hatası
  yaptığında etiket kaybolmamalı, yalnız markanın varsayılan rengine
  düşmeli.
*/
const THEMES: Record<string, AccentKey> = {
  gold: "gold",
  violet: "violet",
  cyan: "cyan",
  magenta: "magenta",
  emerald: "emerald",
  indigo: "indigo",
};

export function seasonAccent(theme: string): AccentKey {
  return THEMES[theme] ?? "violet";
}

/**
 * Sezon etiketinin ince şerit rengi.
 *
 * Sınıf adları TAM METİN: Tailwind kaynağı tarayarak sınıf üretiyor ve
 * kurulmuş bir ad (`bg-${theme}`) derlemeye hiç girmiyor.
 */
export const SEASON_STRIPE: Record<AccentKey, string> = {
  gold: "bg-coin/85 text-[#3a2a00]",
  violet: "bg-primary/85 text-white",
  cyan: "bg-cyan/85 text-[#06283a]",
  magenta: "bg-magenta/85 text-white",
  emerald: "bg-status-success/85 text-white",
  indigo: "bg-indigo/85 text-white",
};
