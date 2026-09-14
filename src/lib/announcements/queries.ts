import type {
  AnnouncementRow,
  LatestAnnouncement,
} from "@/lib/announcements/labels";
import { createClient } from "@/lib/supabase/server";

/*
  Gönderim geçmişi security definer RPC'den geliyor: gönderenin kullanıcı
  adı ve belediye adı RLS altında okunamıyor. Fonksiyon süper admine
  hepsini, personele yalnızca kendi belediyesininkileri veriyor.
*/
export async function listAnnouncements(
  municipalityId?: string | null,
): Promise<AnnouncementRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_announcements", {
    p_municipality: municipalityId ?? null,
  });
  return (data ?? []) as AnnouncementRow[];
}

/**
 * Kullanıcının en son duyurusu — ana sayfadaki afiş için.
 *
 * Duyuru bildirimler üzerinden okunuyor: `announcements` tablosuna
 * kullanıcının select yetkisi yok (gönderim kaydını görmesine gerek yok).
 */
export async function getLatestAnnouncement(): Promise<LatestAnnouncement | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id,title,body,created_at")
    .eq("type", "announcement")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as LatestAnnouncement) ?? null;
}
