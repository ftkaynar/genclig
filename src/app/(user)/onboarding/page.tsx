import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/auth/onboarding-form";
import { AuthShell } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Profilini tamamla — GençLİG",
};

export default async function OnboardingPage() {
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
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  // Profil zaten tamamsa onboarding tekrar gösterilmez.
  if (profile?.username) {
    redirect("/");
  }

  const { data: provinces } = await supabase
    .from("provinces")
    .select("id,name")
    .order("name");

  return (
    <AuthShell
      title="Profilini tamamla"
      description="Kullanıcı adını seç ve nerede yaşadığını söyle."
    >
      <OnboardingForm provinces={provinces ?? []} />
    </AuthShell>
  );
}
