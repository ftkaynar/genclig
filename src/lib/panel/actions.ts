"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type PanelActionState = { error?: string; notice?: string };

/*
  Panel eylemleri. Yetki kontrolü hepsinde veritabanı fonksiyonunun içinde;
  buradaki tek iş çağrı ve hata çevirisi. Kuralları arayüze kopyalamak,
  gerçek kuralla arayüzün zamanla ayrışması demekti.
*/

export async function reviewSubmissionAction(
  submissionId: string,
  action: "approve" | "reject",
  reason?: string,
): Promise<PanelActionState> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("review_submission", {
    p_submission_id: submissionId,
    p_action: action,
    p_reason: reason ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/panel/incelemeler");
  revalidatePath("/admin/incelemeler");
  revalidatePath("/panel");
  return { notice: action === "approve" ? "Teslim onaylandı." : "Teslim reddedildi." };
}

export async function setProblemStatusAction(
  reportId: string,
  status: string,
  note?: string,
): Promise<PanelActionState> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_problem_status", {
    p_report_id: reportId,
    p_new_status: status,
    p_note: note ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/panel/sorunlar");
  revalidatePath("/admin/sorunlar");
  revalidatePath("/panel");
  return { notice: "Durum güncellendi." };
}

// Adı bilerek "use" ile başlamıyor: lint bu önekli fonksiyonları React hook
// sayıp bileşen dışı çağrıları hata olarak işaretliyor.
export async function markCouponUsedAction(
  code: string,
): Promise<PanelActionState> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("use_redemption_code", {
    p_code: code,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/panel/kupon");
  return { notice: "Kupon kullanıldı olarak işaretlendi." };
}

export async function setTaskStatusAction(
  taskId: string,
  status: string,
): Promise<PanelActionState> {
  const supabase = await createClient();

  // tasks üzerindeki RLS yalnızca kendi belediyesinin görevlerine izin veriyor;
  // yetkisiz güncelleme 0 satır etkiliyor ve sessizce geçmesin diye kontrol
  // ediliyor.
  const { data, error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", taskId)
    .select("id");

  if (error || !data || data.length === 0) {
    return { error: "Görev güncellenemedi. Yetkin olmayabilir." };
  }

  revalidatePath("/panel/gorevler");
  revalidatePath("/admin/gorevler");
  return { notice: "Görev durumu güncellendi." };
}
