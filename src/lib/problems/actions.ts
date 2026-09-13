"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ReportState = {
  error?: string;
  reportId?: string;
  xp?: number;
  coin?: number;
};

/*
  Bildirim gönderme. Tüm doğrulama ve puan yazımı report_problem içinde;
  burada yalnızca çağrı ve hata çevirisi var.
*/
export async function submitReportAction(input: {
  kind: string;
  categoryId: number;
  title: string;
  description: string;
  photoPath: string | null;
  lat: number | null;
  lng: number | null;
  addressText: string | null;
}): Promise<ReportState> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("report_problem", {
    p_kind: input.kind,
    p_category_id: input.categoryId,
    p_title: input.title,
    p_description: input.description,
    p_photo_path: input.photoPath,
    p_lat: input.lat,
    p_lng: input.lng,
    p_address_text: input.addressText,
  });

  if (error) {
    // Fonksiyonun fırlattığı mesajlar zaten Türkçe ve kullanıcıya gösterilmek
    // üzere yazıldı; tanınmayan hata ham metin sızdırmadan genelleniyor.
    const known = ["karakter olmalı", "Kategori", "Fotoğraf", "giriş", "Geçersiz"];
    return {
      error: known.some((needle) => error.message.includes(needle))
        ? error.message
        : "Bildirim gönderilemedi. Lütfen tekrar dene.",
    };
  }

  revalidatePath("/bildir/gecmis");
  revalidatePath("/", "layout");

  // Ödül değerleri fonksiyondaki sabitlerle aynı; kullanıcıya ne kazandığını
  // söylemek için burada tekrarlanıyor.
  return {
    reportId: (data as { id?: string } | null)?.id,
    xp: 25,
    coin: 10,
  };
}
