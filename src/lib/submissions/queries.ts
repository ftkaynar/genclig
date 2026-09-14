import type { MySubmission } from "@/lib/submissions/labels";
import { createClient } from "@/lib/supabase/server";

/*
  Kullanıcının kendi teslimleri security definer RPC'den geliyor: görev
  başlığı, ikonu ve ödülü tasks tablosundan okunuyor ve teslim edilen bir
  görev sonradan taslağa alınırsa RLS onu gizlediği için satır başlıksız
  kalırdı. Fonksiyon yalnızca çağıranın kendi tesliminlerini döndürüyor.
*/
export async function listMySubmissions(
  status?: string,
): Promise<MySubmission[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_my_submissions", {
    p_status: status ?? null,
  });
  return (data ?? []) as MySubmission[];
}

/**
 * Bekleyen teslimlerin fotoğraf önizlemesi.
 *
 * Bucket private, bu yüzden imzalı URL üretiliyor. Yalnızca fotoğrafı olan
 * satırlar için çağrılıyor — her teslim için imza üretmek boşuna iş olurdu.
 */
export async function signSubmissionPhotos(
  rows: MySubmission[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const withPhoto = rows.filter((row) => row.photo_path);
  if (withPhoto.length === 0) return result;

  const supabase = await createClient();

  await Promise.all(
    withPhoto.map(async (row) => {
      const { data } = await supabase.storage
        .from("task-proofs")
        .createSignedUrl(row.photo_path as string, 60 * 30);
      if (data?.signedUrl) result.set(row.id, data.signedUrl);
    }),
  );

  return result;
}
