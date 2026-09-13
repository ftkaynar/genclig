import Link from "next/link";
import { redirect } from "next/navigation";

import { ReportForm } from "@/components/problems/report-form";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHeader } from "@/components/user-header";
import { listProblemCategories } from "@/lib/problems/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Şehrin için bildir — GençLİG",
};

export default async function ReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/giris?next=/bildir");
  }

  const categories = await listProblemCategories();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHeader title="Şehrin için bildir" signedIn />

      <main className="flex-1 px-4 py-4">
        <p className="mb-4 text-sm text-ink-muted">
          Mahallende gördüğün bir sorunu, bir öneriyi ya da proje fikrini
          belediyene ilet. Her bildirim +25 XP ve +10 Coin kazandırır.
        </p>

        <ReportForm userId={user.id} categories={categories} />

        <Link
          href="/bildir/gecmis"
          className="mt-4 block rounded-full border border-edge px-4 py-2.5 text-center text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          Bildirimlerim
        </Link>
      </main>

      <UserBottomNav active="home" />
    </div>
  );
}
