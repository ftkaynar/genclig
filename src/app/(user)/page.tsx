import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { UserHeader } from "@/components/user-header";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { BalanceSummary } from "@/components/points/balance-summary";
import { getUserPoints } from "@/lib/points/queries";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

// Kullanıcı PWA ana ekranı. Route group "(user)" URL'e yansımaz, "/" olarak servis edilir.
// Görev listesi /gorevler altında; burada yalnızca karşılama ve kısayol var.

async function loadViewer() {
  // Env tanımlı değilse (örneğin ilk kurulum) sayfa yine de açılsın.
  if (!hasSupabaseEnv()) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  return { user, username: profile?.username ?? null };
}

export default async function UserHomePage() {
  const viewer = await loadViewer();

  // Oturum var ama profil eksikse onboarding zorunlu.
  if (viewer && !viewer.username) {
    redirect("/onboarding");
  }

  const points = viewer ? await getUserPoints(viewer.user.id) : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHeader signedIn={Boolean(viewer)} />

      {/*
        Marka gradyanı tek bir imza alanında kullanılıyor. Tüm sayfayı
        gradyanla kaplamak, tema açığa alındığında okunabilirliği bozuyordu.
      */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <section className="brand-gradient w-full rounded-3xl px-6 py-10 text-center shadow-lg">
          <Image
            src="/brand/logo-mark.png"
            alt="GençLİG logosu"
            width={96}
            height={96}
            className="mx-auto h-24 w-24"
            priority
          />

          {viewer ? (
            <>
              <h1 className="mt-5 text-3xl font-bold tracking-tight text-white">
                Merhaba, {viewer.username}
              </h1>
              <p className="mt-2 text-sm text-white/80">
                Şehrinde görev yap, puan kazan.
              </p>

              {points ? <BalanceSummary points={points} /> : null}

              <Link
                href="/gorevler"
                className="mt-7 block w-full rounded-full bg-cta px-6 py-3 text-base font-semibold text-brand transition-opacity hover:opacity-90"
              >
                Görevler
              </Link>

              <Link
                href="/bildir"
                className="mt-3 block w-full rounded-full border border-white/40 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                Şehrin için bildir
              </Link>
            </>
          ) : (
            <>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-white">
                GençLİG
              </h1>
              <p className="mt-2 text-sm text-white/80">
                Şehrinde görev yap, puan kazan.
              </p>

              <Link
                href="/kayit"
                className="mt-7 block w-full rounded-full bg-cta px-6 py-3 text-base font-semibold text-brand transition-opacity hover:opacity-90"
              >
                Hemen başla
              </Link>
              <Link
                href="/giris"
                className="mt-3 block w-full rounded-full border border-white/40 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                Giriş yap
              </Link>
            </>
          )}
        </section>
      </main>

      <UserBottomNav active="home" />
    </div>
  );
}
