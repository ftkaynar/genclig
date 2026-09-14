import { redirect } from "next/navigation";

import { SupportView } from "@/components/support/support-view";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHeader } from "@/components/user-header";
import { listFaq, listMyTickets } from "@/lib/support/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Destek — GençLİG",
};

export default async function SupportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/giris?next=/destek");
  }

  const [faq, tickets] = await Promise.all([listFaq(), listMyTickets()]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHeader title="Destek" signedIn />

      <main className="flex-1 px-4 py-4">
        <SupportView faq={faq} tickets={tickets} />
      </main>

      <UserBottomNav active="profile" />
    </div>
  );
}
