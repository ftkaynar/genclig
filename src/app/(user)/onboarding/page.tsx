import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/auth/onboarding-form";
import { AuthShell } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Profilini tamamla — GençLİG",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ davet?: string }>;
}) {
  /*
    Davet kodu URL'den geliyor (/kayit?davet=KOD → onboarding).

    Büyük harfe çevriliyor: kod alfabesi yalnız büyük harf ve rakam,
    ama kullanıcı bağlantıyı küçük harfle yazabiliyor.
  */
  const params = await searchParams;
  const jar = await cookies();

  // URL kazanıyor; yoksa kayıt sırasında yazılan çerez okunuyor.
  const inviteCode = (params.davet ?? jar.get("genclig-invite")?.value ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 8);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware bunu zaten yakalıyor; burada ikinci kez bakılıyor çünkü sayfa
  // matcher'ın dışında kalacak şekilde yeniden yapılandırılırsa koruma
  // sessizce kalkmasın.
  if (!user) {
    redirect("/giris?next=/onboarding");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username,phone")
    .eq("id", user.id)
    .maybeSingle();

  /*
    Profil zaten tamamsa onboarding tekrar gösterilmez.

    "Tamam" tanımına telefon da girdi (D24 FAZ F1). Kullanıcı adı olup
    telefonu olmayan mevcut hesaplar bu ekrana bir kez daha uğruyor;
    form kullanıcı adını dolu getiriyor ki baştan yazmak zorunda
    kalmasınlar.
  */
  if (profile?.username && profile?.phone) {
    redirect("/");
  }

  const { data: provinces } = await supabase
    .from("provinces")
    .select("id,name")
    .order("name");

  return (
    <AuthShell
      title="Profilini tamamla"
      description="Kullanıcı adını, telefonunu ve nerede yaşadığını gir."
    >
      {/* Kullanıcı adı doluysa (telefon eksik olduğu için buradaysa)
          yeniden yazdırmıyoruz. */}
      <OnboardingForm
        provinces={provinces ?? []}
        initialUsername={profile?.username ?? ""}
        initialInviteCode={inviteCode}
      />
    </AuthShell>
  );
}
