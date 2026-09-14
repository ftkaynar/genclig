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

  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const provinceId = String(formData.get("provinceId") ?? "").trim();
  const districtId = String(formData.get("districtId") ?? "").trim();
  const neighborhoodId = String(formData.get("neighborhoodId") ?? "").trim();

  if (displayName.length > 0 && displayName.length < 2) {
    return { error: "Görünen ad en az 2 karakter olmalı." };
  }

  // Kullanıcı adı kuralı onboarding ile aynı; iki yerde ayrışmasın diye
  // aynı desen kullanılıyor.
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return {
      error:
        "Kullanıcı adı 3-20 karakter olmalı; yalnızca küçük harf, rakam ve alt çizgi.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      display_name: displayName || null,
      province_id: provinceId ? Number(provinceId) : null,
      district_id: districtId ? Number(districtId) : null,
      neighborhood_id: neighborhoodId ? Number(neighborhoodId) : null,
    })
    .eq("id", user.id);

  if (error) {
    // 23505: unique ihlali. username citext, büyük/küçük harf farkı da çakışma.
    if (error.code === "23505") {
      return { error: "Bu kullanıcı adı alınmış. Başka bir tane dene." };
    }
    return { error: "Profil kaydedilemedi. Lütfen tekrar dene." };
  }

  /*
    Telefon `set_phone` ile: normalize etme ve benzersizlik kontrolü
    orada. Boş bırakılırsa dokunulmuyor — ayarlar ekranında telefon
    zorunlu değil, ZATEN kayıtlı olduğu için onboarding'de alınmış
    oluyor. Silme yolu bilerek yok; telefon zorunlu bir alan.
  */
  if (phone.length > 0) {
    const { error: phoneError } = await supabase.rpc("set_phone", {
      p_phone: phone,
    });

    if (phoneError) {
      const known = [
        "Bu telefon zaten kayıtlı",
        "Geçerli bir cep telefonu",
        "zorunlu",
      ];
      return {
        error: known.some((needle) => phoneError.message.includes(needle))
          ? phoneError.message
          : "Telefon kaydedilemedi. Lütfen tekrar dene.",
      };
    }
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
