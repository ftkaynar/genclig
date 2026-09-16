import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

import { signOutAction } from "@/lib/auth/actions";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { ProfileForm } from "@/components/profile/profile-form";
import { PushToggle } from "@/components/notifications/push-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHeader } from "@/components/user-header";
import { getViewerProfile, getViewerUser } from "@/lib/auth/viewer";
import { getProvinces } from "@/lib/reference/queries";

export const metadata = {
  title: "Ayarlar — GençLİG",
};

export default async function SettingsPage() {
  const user = await getViewerUser();

  if (!user) {
    redirect("/giris?next=/ayarlar");
  }

  // Profil istek başına önbellekli, iller saatlik referans önbelleğinde.
  const [profile, provinces] = await Promise.all([
    getViewerProfile(),
    getProvinces(),
  ]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHeader title="Ayarlar" signedIn />

      <main className="flex-1 px-4 py-4 has-bottom-nav">
        <section className="rounded-2xl border border-edge bg-card p-4">
          <AvatarUpload
            userId={user.id}
            currentUrl={profile?.avatar_url ?? null}
          />
        </section>

        <section className="mt-4 rounded-2xl border border-edge bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Profil bilgileri</h2>
          <ProfileForm
            provinces={provinces ?? []}
            initial={{
              username: profile?.username ?? "",
              // Kayıtlı numara "+905321112233" biçiminde; kullanıcıya
              // yerel yazımla gösteriliyor.
              phone: profile?.phone ? profile.phone.replace("+90", "") : "",
              displayName: profile?.display_name ?? "",
              provinceId: profile?.province_id ? String(profile.province_id) : "",
              districtId: profile?.district_id ? String(profile.district_id) : "",
              neighborhoodId: profile?.neighborhood_id
                ? String(profile.neighborhood_id)
                : "",
            }}
          />
        </section>

        {/*
          Bildirim izni burada isteniyor, sayfa açılır açılmaz değil:
          tarayıcılar kullanıcı jesti olmadan yapılan izin isteklerini
          sessizce reddediyor ve izin bir daha sorulmuyor.
        */}
        <section className="mt-4">
          <PushToggle
            publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
          />
        </section>

        <section className="mt-4 flex items-center justify-between rounded-2xl border border-edge bg-card p-4">
          <span className="text-sm font-medium text-ink">Tema</span>
          <ThemeToggle />
        </section>

        <section className="mt-4">
          <form action={signOutAction}>
            <Button variant="danger" size="lg" block type="submit">
              Çıkış yap
            </Button>
          </form>
        </section>
      </main>

      <UserBottomNav active="profile" />
    </div>
  );
}
