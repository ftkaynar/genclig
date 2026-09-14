"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/*
  Teslim açma sunucudan çağrılıyor.

  İş kararının tamamı submit_task fonksiyonunun içinde: konum doğrulaması,
  kapasite, tekrar deneme kuralı. Burada yapılan tek şey çağrıyı iletmek,
  hatayı kullanıcıya taşımak ve kutlama ekranının ihtiyaç duyduğu bilgileri
  (seviye atladı mı, yeni rozet düştü mü) toplamak.
*/

export type SubmitState = {
  error?: string;
  status?: "approved" | "pending";
  /** Seviye atlandıysa yeni seviye; atlanmadıysa null. */
  levelUp?: number | null;
  /** Bu teslimle kazanılan rozetin adı; yoksa null. */
  newBadge?: string | null;
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
    "takım görevi",
  ];

  return known.some((needle) => message.includes(needle))
    ? message
    : "Görev gönderilemedi. Lütfen tekrar dene.";
}

/** Kullanıcının o anki seviyesi; kutlama ekranı için önce/sonra kıyaslanıyor. */
async function readLevel(userId: string): Promise<number> {
  const supabase = await createClient();

  const { data: balance } = await supabase
    .from("user_xp_balance")
    .select("total_xp")
    .eq("user_id", userId)
    .maybeSingle();

  const { data } = await supabase.rpc("level_from_xp", {
    p_xp: balance?.total_xp ?? 0,
  });

  const row = Array.isArray(data) ? data[0] : data;
  return (row as { level?: number } | null)?.level ?? 1;
}

export async function submitTaskAction(
  taskId: string,
  lat: number | null,
  lng: number | null,
  photoPath: string | null,
): Promise<SubmitState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Oturumun sona ermiş. Tekrar giriş yap." };
  }

  const levelBefore = await readLevel(user.id);

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
  revalidatePath("/", "layout");

  const status = (data as { status?: string } | null)?.status;
  const approved = status === "approved";

  let levelUp: number | null = null;
  let newBadge: string | null = null;

  if (approved) {
    const levelAfter = await readLevel(user.id);
    levelUp = levelAfter > levelBefore ? levelAfter : null;

    /*
      Rozet bildirimleri award_task_points içinde yazılıyor. Son on saniye
      içindeki badge_earned kaydına bakmak, bu teslimle düşen rozeti yakalamak
      için yeterli; rozet tablosunu ayrıca sorgulayıp fark almaktan basit.
    */
    const since = new Date(Date.now() - 10_000).toISOString();
    const { data: badgeRows } = await supabase
      .from("notifications")
      .select("title")
      .eq("user_id", user.id)
      .eq("type", "badge_earned")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1);

    newBadge = badgeRows?.[0]?.title ?? null;
  }

  return { status: approved ? "approved" : "pending", levelUp, newBadge };
}
