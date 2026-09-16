"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push/send";

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

  /*
    Teslim sahibini ve ödülü ÖNCEDEN okuyoruz: onaydan sonra satır
    hâlâ okunabilir ama push metninde XP/Token yazmak için görevin
    ödülü gerekiyor ve bunu ikinci bir sorguyla almak yerine tek
    seferde alıyoruz.
  */
  const { data: sub } = await supabase
    .from("task_submissions")
    .select("user_id,tasks(title,xp,coin)")
    .eq("id", submissionId)
    .maybeSingle();

  const { error } = await supabase.rpc("review_submission", {
    p_submission_id: submissionId,
    p_action: action,
    p_reason: reason ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  /*
    Push YALNIZCA başarılı RPC'den sonra. Hata durumunda bildirim
    göndermek, olmayan bir onayı duyurmak olurdu.

    sendPushToUser asla fırlatmıyor; push bir yan etki ve onay
    akışını kırmamalı.
  */
  const target = sub as unknown as
    | { user_id: string; tasks: { title: string; xp: number; coin: number } | null }
    | null;

  if (target?.user_id) {
    await sendPushToUser(target.user_id, {
      title:
        action === "approve"
          ? "Görevin onaylandı!"
          : "Teslimin reddedildi",
      body:
        action === "approve"
          ? `${target.tasks?.title ?? "Görev"} · +${target.tasks?.xp ?? 0} XP +${target.tasks?.coin ?? 0} Token`
          : (reason ?? "Ayrıntı için Görevlerim ekranına bak."),
      url: "/gorevlerim",
      tag: "submission",
    });
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
