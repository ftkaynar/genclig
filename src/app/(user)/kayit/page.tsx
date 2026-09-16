import Link from "next/link";

import { SignUpForm } from "@/components/auth/sign-up-form";
import { AuthShell } from "@/components/ui/form";

export const metadata = {
  title: "Hesap aç — GençLİG",
};

/*
  Davet kodu kayıt akışında TAŞINMAK zorunda (D33 FAZ DV).

  Akış: /kayit?davet=KOD -> e-posta doğrulama -> /onboarding.
  Arada e-posta istemcisi var, yani URL parametresi kayboluyor.
  Bu yüzden kod kayıt eyleminde ÇEREZE yazılıyor ve onboarding
  URL'de kod yoksa çerezden okuyor.

  Çerez denendi ve seçildi; alternatifler elendi:
    - auth metadata: doğrulama öncesi kullanıcı yok.
    - emailRedirectTo'ya eklemek: Supabase yönlendirme beyaz
      listesi her parametre kombinasyonunu kabul etmiyor.
*/
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ davet?: string }>;
}) {
  const params = await searchParams;
  const inviteCode = (params.davet ?? "").trim().toUpperCase().slice(0, 8);

  return (
    <AuthShell
      title="Hesap aç"
      description="E-posta adresinle kaydol, şehrindeki görevlere başla."
      footer={
        <>
          Zaten hesabın var mı?{" "}
          <Link href="/giris" className="font-semibold text-primary hover:underline">
            Giriş yap
          </Link>
        </>
      }
    >
      <SignUpForm inviteCode={inviteCode} />
    </AuthShell>
  );
}
