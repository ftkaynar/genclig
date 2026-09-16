import Link from "next/link";
import { redirect } from "next/navigation";

import { ReportForm } from "@/components/problems/report-form";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHeader } from "@/components/user-header";
import { listProblemCategories } from "@/lib/problems/queries";
import { getViewerUser } from "@/lib/auth/viewer";

export const metadata = {
  title: "Şehrin için bildir — GençLİG",
};

export default async function ReportPage() {
  const user = await getViewerUser();

  if (!user) {
    redirect("/giris?next=/bildir");
  }

  const categories = await listProblemCategories();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHeader title="Şehrin için bildir" signedIn />

      <main className="flex-1 px-4 py-4 has-bottom-nav">
        <p className="mb-4 text-sm text-ink-muted">
          Mahallende gördüğün bir sorunu, bir öneriyi ya da proje fikrini
          belediyene ilet. Her bildirim +25 XP ve +10 Token kazandırır.
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
