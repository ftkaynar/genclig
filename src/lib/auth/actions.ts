"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/*
  Kimlik akışlarının tamamı sunucuda. Client yalnızca form gönderiyor.
  Neden: oturum çerezi httpOnly olarak sunucuda yazılıyor ve profil yazımı
  RLS altında kullanıcının kendi satırına sınırlı; karar client'a bırakılsaydı
  doğrulama yalnızca görsel bir engel olurdu (bkz. AGENTS.md madde 10).
*/

export type ActionState = {
  error?: string;
  notice?: string;
};

const MIN_PASSWORD_LENGTH = 8;

/** Kullanıcı adı: 3-20 karakter, küçük harf, rakam ve alt çizgi. */
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Supabase hata metinlerini Türkçeleştirir.
 * Neden eşleme tablosu: Supabase mesajları İngilizce ve kullanıcıya
 * gösterilemez; tanımadığımız bir hata geldiğinde genel bir metne düşülüyor,
 * ham mesaj sızdırılmıyor.
 */
function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "E-posta veya şifre hatalı.";
  }
  if (normalized.includes("email not confirmed")) {
    return "E-posta adresin henüz doğrulanmamış. Gelen kutunu kontrol et.";
  }
  if (normalized.includes("user already registered")) {
    return "Bu e-posta adresi zaten kayıtlı. Giriş yapmayı dene.";
  }
  if (normalized.includes("password")) {
    return `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`;
  }
  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.";
  }

  return "Bir sorun oluştu. Lütfen tekrar dene.";
}

/** E-posta doğrulama linkinin geri döneceği mutlak adres. */
async function confirmRedirectUrl(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}/auth/confirm?next=/onboarding`;
}

export async function signUpAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = readString(formData, "email");
  const password = readString(formData, "password");
  const passwordRepeat = readString(formData, "passwordRepeat");

  if (!email || !password || !passwordRepeat) {
    return { error: "Tüm alanları doldur." };
  }
  if (!email.includes("@")) {
    return { error: "Geçerli bir e-posta adresi gir." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.` };
  }
  if (password !== passwordRepeat) {
    return { error: "Şifreler birbiriyle uyuşmuyor." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: await confirmRedirectUrl() },
  });

  if (error) {
    return { error: translateAuthError(error.message) };
  }

  redirect(`/kayit/dogrulama?email=${encodeURIComponent(email)}`);
}

export async function signInAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = readString(formData, "email");
  const password = readString(formData, "password");
  const next = readString(formData, "next");

  if (!email || !password) {
    return { error: "E-posta ve şifre gerekli." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: translateAuthError(error.message) };
  }

  revalidatePath("/", "layout");
  // Açık yönlendirme olmasın diye yalnızca kendi sitemizdeki yollara izin var.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function completeOnboardingAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const username = readString(formData, "username").toLowerCase();
  const phone = readString(formData, "phone");
  const provinceId = readString(formData, "provinceId");
  const districtId = readString(formData, "districtId");
  const neighborhoodId = readString(formData, "neighborhoodId");

  if (!USERNAME_PATTERN.test(username)) {
    return {
      error:
        "Kullanıcı adı 3-20 karakter olmalı; yalnızca küçük harf, rakam ve alt çizgi kullanılabilir.",
    };
  }
  if (!phone.trim()) {
    return { error: "Telefon numaran zorunlu." };
  }
  if (!provinceId) {
    return { error: "İl seçmelisin." };
  }
  if (!districtId) {
    return { error: "İlçe seçmelisin." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/giris");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      display_name: username,
      province_id: Number(provinceId),
      district_id: Number(districtId),
      // "Mahallem listede yok" seçilirse alan boş kalır.
      neighborhood_id: neighborhoodId ? Number(neighborhoodId) : null,
    })
    .eq("id", user.id);

  if (error) {
    // 23505: unique ihlali. username citext olduğu için büyük/küçük harf
    // farkı da çakışma sayılır.
    if (error.code === "23505") {
      return { error: "Bu kullanıcı adı alınmış. Başka bir tane dene." };
    }
    return { error: "Profil kaydedilemedi. Lütfen tekrar dene." };
  }

  /*
    Telefon ayrı RPC ile yazılıyor: normalize etme (0532…, +90 532…,
    532… → +905321112233) ve benzersizlik kontrolü sunucuda,
    `set_phone` içinde. Profil güncellemesiyle aynı çağrıda yazılsaydı
    biçim doğrulaması istemciye düşerdi.

    Sıra önemli: profil önce yazılıyor, telefon sonra. Telefon
    benzersizlik hatası verirse kullanıcı adı çoktan kaydedilmiş oluyor
    ve kullanıcı yalnızca telefonu düzeltip devam edebiliyor — tersi
    sırada kullanıcı adını her denemede yeniden girmesi gerekirdi.
  */
  const { error: phoneError } = await supabase.rpc("set_phone", {
    p_phone: phone,
  });

  if (phoneError) {
    const known = ["Bu telefon zaten kayıtlı", "Geçerli bir cep telefonu", "zorunlu"];
    return {
      error: known.some((needle) => phoneError.message.includes(needle))
        ? phoneError.message
        : "Telefon kaydedilemedi. Lütfen tekrar dene.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
