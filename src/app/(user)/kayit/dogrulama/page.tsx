import Link from "next/link";

import { AuthShell } from "@/components/ui/form";

export const metadata = {
  title: "E-posta doğrulama — GençLİG",
};

/*
  Kayıt sonrası bekleme ekranı.
  E-posta doğrulaması Supabase tarafında açık bırakıldı; kullanıcı linke
  tıklayana kadar oturum açılmıyor.
*/
export default async function VerifyNoticePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <AuthShell
      title="E-postanı doğrula"
      description={
        email
          ? `${email} adresine bir doğrulama bağlantısı gönderdik.`
          : "Adresine bir doğrulama bağlantısı gönderdik."
      }
      footer={
        <Link href="/giris" className="font-semibold text-primary hover:underline">
          Giriş sayfasına dön
        </Link>
      }
    >
      <div className="flex flex-col gap-3 text-sm text-ink-muted">
        <p>
          Bağlantıya tıkladığında hesabın etkinleşecek ve profil bilgilerini
          doldurabileceksin.
        </p>
        <p>
          E-posta birkaç dakika içinde gelmezse spam klasörünü kontrol et.
        </p>
      </div>
    </AuthShell>
  );
}
