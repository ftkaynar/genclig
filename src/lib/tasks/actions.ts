"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/*
  Teslim açma sunucudan çağrılıyor.

  İş kararının tamamı submit_task fonksiyonunun içinde: konum doğrulaması,
  kapasite, tekrar deneme kuralı. Burada yapılan tek şey çağrıyı iletmek ve
  hatayı kullanıcıya taşımak. Kuralları buraya kopyalamak, client'ın gördüğü
  kontrolle veritabanının uyguladığı kuralın zamanla ayrışması demekti.
*/

export type SubmitState = {
  error?: string;
  status?: "approved" | "pending";
};

/**
 * submit_task'ın fırlattığı mesajlar zaten Türkçe ve kullanıcıya gösterilmek
 * üzere yazıldı. Tanınmayan bir hata gelirse ham metin sızdırılmıyor.
 */
function toUserMessage(message: string): string {
  const known = [
    "giriş yapmalısın",
    "Görev bulunamadı",
    "Görev aktif değil",
    "Görev henüz başlamadı",
    "süresi dolmuş",
    "zaten gönderdin",
    "kontenjanı doldu",
    "Konum bilgisi alınamadı",
    "hedef konumu tanımlı değil",
    "uzaktasın",
    "Fotoğraf yüklenmedi",
    "Fotoğraf bulunamadı",
  ];

  return known.some((needle) => message.includes(needle))
    ? message
    : "Görev gönderilemedi. Lütfen tekrar dene.";
}

export async function submitTaskAction(
  taskId: string,
  lat: number | null,
  lng: number | null,
  photoPath: string | null,
): Promise<SubmitState> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("submit_task", {
    p_task_id: taskId,
    p_lat: lat,
    p_lng: lng,
    p_photo_path: photoPath,
  });

  if (error) {
    return { error: toUserMessage(error.message) };
  }

  revalidatePath(`/gorevler/${taskId}`);
  revalidatePath("/gorevler");

  const status = (data as { status?: string } | null)?.status;
  return { status: status === "approved" ? "approved" : "pending" };
}
