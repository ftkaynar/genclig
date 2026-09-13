import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * E-posta doğrulama linkinin indiği yer.
 *
 * İki biçim de karşılanıyor: Supabase yapılandırmasına göre link ya PKCE
 * kodu (?code=) ya da tek kullanımlık özet (?token_hash=&type=) taşıyor.
 * Sadece biri desteklenseydi, e-posta şablonu veya akış ayarı değiştiğinde
 * doğrulama sessizce kırılırdı.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/";

  // Açık yönlendirme olmasın diye yalnızca kendi sitemizdeki yollar.
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/giris?hata=dogrulama", request.url));
}
