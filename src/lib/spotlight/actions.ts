"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type SpotlightState = { error?: string; notice?: string };

/*
  Günün Görevi sabitleme (D33 FAZ GG).

  Yetki kontrolü RPC'nin İÇİNDE (is_super_admin). Burada tekrar
  kontrol edilmiyor: iki yerde duran bir yetki kuralı, birinin
  gevşemesi demek. Sunucu eylemi yalnız çağrı ve hata çevirisi yapıyor.
*/

/** Kullanıcıya gösterilecek hata metni. */
function translate(message: string): string {
  if (message.includes("yetkin yok")) {
    return "Bu işlem için yetkin yok.";
  }
  if (message.includes("bugün ya da yarın")) {
    return "Yalnızca bugün ya da yarın için seçim yapabilirsin.";
  }
  if (message.includes("Görev bulunamadı")) {
    return "Görev bulunamadı ya da yayında değil.";
  }
  if (message.includes("Geçmiş gün")) {
    return "Geçmiş gün değiştirilemez.";
  }
  return "İşlem tamamlanamadı.";
}

/** İlgili tüm ekranlar tazeleniyor: vitrin üç yerde birden görünüyor. */
function refresh() {
  revalidatePath("/admin/gunun-gorevi");
  revalidatePath("/");
  revalidatePath("/gorevler");
}

export async function setSpotlightAction(
  day: string,
  taskId: string,
): Promise<SpotlightState> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_daily_spotlight", {
    p_day: day,
    p_task: taskId,
  });

  if (error) return { error: translate(error.message) };

  refresh();
  return { notice: "Günün Görevi ayarlandı." };
}

export async function clearSpotlightAction(
  day: string,
): Promise<SpotlightState> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("clear_daily_spotlight", {
    p_day: day,
  });

  if (error) return { error: translate(error.message) };

  refresh();
  return { notice: "Seçim kaldırıldı; otomatik seçime döndü." };
}
