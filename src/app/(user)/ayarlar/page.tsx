import { redirect } from "next/navigation";

import { signOutAction } from "@/lib/auth/actions";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { ProfileForm } from "@/components/profile/profile-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHeader } from "@/components/user-header";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Ayarlar — GençLİG",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/giris?next=/ayarlar");
  }

  const [{ data: profile }, { data: provinces }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name,avatar_url,province_id,district_id,neighborhood_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("provinces").select("id,name").order("name"),
  ]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHeader title="Ayarlar" signedIn />

      <main className="flex-1 px-4 py-4">
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
              displayName: profile?.display_name ?? "",
              provinceId: profile?.province_id ? String(profile.province_id) : "",
              districtId: profile?.district_id ? String(profile.district_id) : "",
              neighborhoodId: profile?.neighborhood_id
                ? String(profile.neighborhood_id)
                : "",
            }}
          />
        </section>

        <section className="mt-4 flex items-center justify-between rounded-2xl border border-edge bg-card p-4">
          <span className="text-sm font-medium text-ink">Tema</span>
          <ThemeToggle />
        </section>

        <section className="mt-4">
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full rounded-full border border-status-danger/50 px-6 py-3 text-base font-semibold text-status-danger transition-colors hover:bg-status-danger/10"
            >
              Çıkış yap
            </button>
          </form>
        </section>
      </main>

      <UserBottomNav active="profile" />
    </div>
  );
}
