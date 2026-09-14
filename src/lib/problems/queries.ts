import { createClient } from "@/lib/supabase/server";
import { getViewerUser } from "@/lib/auth/viewer";
import { getProblemCategories } from "@/lib/reference/queries";

export const KIND_LABEL: Record<string, string> = {
  problem: "Sorun",
  oneri: "Öneri",
  proje: "Proje",
};

export const PROBLEM_STATUS_LABEL: Record<string, string> = {
  new: "Yeni",
  reviewing: "İnceleniyor",
  in_progress: "İşlemde",
  resolved: "Çözüldü",
  rejected: "Reddedildi",
};

/** Durum rozetinin rengi; renkler D04 token'larından. */
export const PROBLEM_STATUS_TONE: Record<string, string> = {
  new: "bg-surface text-ink-muted",
  reviewing: "bg-xp/15 text-xp",
  in_progress: "bg-status-warning/15 text-status-warning",
  resolved: "bg-primary/15 text-primary",
  rejected: "bg-status-danger/15 text-status-danger",
};

export type ProblemCategory = { id: number; name: string; slug: string };

export type ProblemReportRow = {
  id: string;
  kind: string;
  title: string;
  description: string;
  status: string;
  photo_path: string | null;
  lat: number | null;
  lng: number | null;
  address_text: string | null;
  created_at: string;
  problem_categories: { name: string } | null;
};

export async function listProblemCategories(): Promise<ProblemCategory[]> {
  // Kategoriler herkes için aynı; referans önbelleğinden geliyor.
  return (await getProblemCategories()) as ProblemCategory[];
}

export async function listMyReports(): Promise<ProblemReportRow[]> {
  const supabase = await createClient();
  const user = await getViewerUser();
  if (!user) return [];

  const { data } = await supabase
    .from("problem_reports")
    .select(
      "id,kind,title,description,status,photo_path,lat,lng,address_text,created_at,problem_categories(name)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []) as unknown as ProblemReportRow[];
}

export type StatusHistoryRow = {
  id: string;
  old_status: string | null;
  new_status: string;
  note: string | null;
  created_at: string;
};

export async function getReportHistory(
  reportId: string,
): Promise<StatusHistoryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("problem_status_history")
    .select("id,old_status,new_status,note,created_at")
    .eq("report_id", reportId)
    .order("created_at");
  return (data ?? []) as StatusHistoryRow[];
}
