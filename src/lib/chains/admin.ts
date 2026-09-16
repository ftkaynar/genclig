"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ChainAdminState = { error?: string; notice?: string; id?: string };

export type AdminChainRow = {
  id: string;
  title: string;
  description: string;
  icon: string | null;
  bonus_xp: number;
  bonus_token: number;
  status: string;
  sort: number;
  step_ids: string[];
};

/*
  Zincir yönetimi (D33 FAZ Z).

  Yetki RLS'te: task_chains ve chain_steps yazma politikaları
  is_super_admin() istiyor. Burada ikinci bir kontrol YOK — iki yerde
  duran bir yetki kuralı, birinin gevşemesi demek. Yetkisiz çağrı
  PostgREST'ten RLS hatasıyla dönüyor ve aşağıda çevriliyor.
*/

function refresh() {
  revalidatePath("/admin/zincirler");
  revalidatePath("/gorevler");
}

function translate(message: string): string {
  if (
    message.includes("row-level security") ||
    message.includes("permission denied")
  ) {
    return "Bu işlem için yetkin yok.";
  }
  if (message.includes("bonus_xp") || message.includes("bonus_token")) {
    return "Bonus değerleri negatif olamaz.";
  }
  return "İşlem tamamlanamadı.";
}

function toInt(value: string, fallback = 0): number {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
}

/**
 * Zinciri kaydeder ve adımlarını SENKRONLAR.
 *
 * Adımlar tek hamlede yazılıyor: önce silinip sonra ekleniyor. Fark
 * hesaplayıp yalnız değişenlere dokunmak denendi ve elendi — sıra
 * değişikliği (sort) neredeyse her kaydetmede tüm satırlara dokunuyor
 * ve fark hesabı kazanç getirmiyordu.
 *
 * chain_awards'a DOKUNULMUYOR: adım listesi değişse bile daha önce
 * bonusu almış kullanıcının kaydı duruyor. Silmek, zinciri yeniden
 * ödüllendirilebilir hale getirirdi.
 */
export async function saveChainAction(input: {
  id?: string;
  title: string;
  description: string;
  icon: string;
  bonusXp: string;
  bonusToken: string;
  status: string;
  sort: string;
  stepIds: string[];
}): Promise<ChainAdminState> {
  const supabase = await createClient();

  const title = input.title.trim();
  if (title.length < 3) {
    return { error: "Başlık en az 3 karakter olmalı." };
  }

  const payload = {
    title,
    description: input.description.trim(),
    icon: input.icon.trim() || null,
    bonus_xp: toInt(input.bonusXp),
    bonus_token: toInt(input.bonusToken),
    status: input.status === "passive" ? "passive" : "active",
    sort: toInt(input.sort),
  };

  const { data, error } = input.id
    ? await supabase
        .from("task_chains")
        .update(payload)
        .eq("id", input.id)
        .select("id")
    : await supabase.from("task_chains").insert(payload).select("id");

  if (error || !data || data.length === 0) {
    return { error: error ? translate(error.message) : "Zincir kaydedilemedi." };
  }

  const chainId = data[0].id as string;

  const { error: clearError } = await supabase
    .from("chain_steps")
    .delete()
    .eq("chain_id", chainId);

  if (clearError) {
    return { error: translate(clearError.message) };
  }

  // Yinelenen görev seçimi birincil anahtarı ihlal ederdi; burada eleniyor.
  const unique = [...new Set(input.stepIds.filter(Boolean))];

  if (unique.length > 0) {
    const { error: stepError } = await supabase.from("chain_steps").insert(
      unique.map((taskId, index) => ({
        chain_id: chainId,
        task_id: taskId,
        sort: index,
      })),
    );

    if (stepError) {
      return { error: translate(stepError.message) };
    }
  }

  refresh();
  return { notice: "Zincir kaydedildi.", id: chainId };
}

/**
 * Zinciri siler.
 *
 * chain_steps ve chain_awards cascade ile gidiyor. Silmek yerine
 * pasife almak tercih edilmeli — bonusu almış kullanıcıların kaydı da
 * silindiği için zincir yeniden açılırsa herkes ikinci kez ödül alır.
 * Arayüz bunu uyarı olarak söylüyor.
 */
export async function deleteChainAction(id: string): Promise<ChainAdminState> {
  const supabase = await createClient();

  const { error } = await supabase.from("task_chains").delete().eq("id", id);

  if (error) return { error: translate(error.message) };

  refresh();
  return { notice: "Zincir silindi." };
}
