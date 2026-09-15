import { createClient } from "@/lib/supabase/server";
import { getViewerUser } from "@/lib/auth/viewer";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  ref_id: string | null;
  is_read: boolean;
  created_at: string;
};

/** Bildirim türüne göre kullanıcıya görünen etiket. */
export const NOTIFICATION_LABEL: Record<string, string> = {
  submission_approved: "Görev onayı",
  submission_rejected: "Görev reddi",
  badge_earned: "Yeni rozet",
  problem_status: "Bildirim durumu",
  reward_redeemed: "Ödül",
  system: "Sistem",
  stat_decay: "Kart soğuyor",
};

/** Bildirim türüne göre ikon. */
export const NOTIFICATION_ICON: Record<string, string> = {
  submission_approved: "check",
  submission_rejected: "shield",
  badge_earned: "award",
  problem_status: "megaphone",
  reward_redeemed: "gift",
  system: "bell",
  stat_decay: "activity",
};

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();

  const user = await getViewerUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  return count ?? 0;
}

export async function listNotifications(
  limit = 50,
): Promise<NotificationRow[]> {
  const supabase = await createClient();

  const user = await getViewerUser();
  if (!user) return [];

  // RLS zaten kendi satırlarıyla sınırlıyor; user_id filtresi indeksi
  // kullandırmak ve niyeti açık bırakmak için yine de yazılı.
  const { data } = await supabase
    .from("notifications")
    .select("id,type,title,body,ref_id,is_read,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as NotificationRow[];
}

/** "3 saat önce" biçiminde göreli zaman. */
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dakika önce`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} gün önce`;

  return new Date(iso).toLocaleDateString("tr-TR");
}
