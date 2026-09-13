"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ProfileActionState = {
  error?: string;
  notice?: string;
};

/*
  Profil güncellemesi doğrudan tabloya yazılıyor, rpc'ye gerek yok: profiles
  üzerindeki RLS zaten kullanıcıyı kendi satırıyla sınırlıyor ve id ile
  created_at'i tetikleyici koruyor. Yazılabilen alanlar burada açıkça
  sayıldığı için client'ın gönderdiği fazladan alan da geçmiyor.
*/
export async function updateProfileAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Oturumun sona ermiş. Tekrar giriş yap." };
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  const provinceId = String(formData.get("provinceId") ?? "").trim();
  const districtId = String(formData.get("districtId") ?? "").trim();
  const neighborhoodId = String(formData.get("neighborhoodId") ?? "").trim();

  if (displayName.length > 0 && displayName.length < 2) {
    return { error: "Görünen ad en az 2 karakter olmalı." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName || null,
      province_id: provinceId ? Number(provinceId) : null,
      district_id: districtId ? Number(districtId) : null,
      neighborhood_id: neighborhoodId ? Number(neighborhoodId) : null,
    })
    .eq("id", user.id);

  if (error) {
    return { error: "Profil kaydedilemedi. Lütfen tekrar dene." };
  }

  revalidatePath("/profil");
  revalidatePath("/ayarlar");
  return { notice: "Profilin güncellendi." };
}

/** Avatar yüklendikten sonra profildeki adresi günceller. */
export async function setAvatarUrlAction(url: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);

  revalidatePath("/profil");
  revalidatePath("/ayarlar");
}
