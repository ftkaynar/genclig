import { redirect } from "next/navigation";
import { RewardFab } from "@/components/rewards/reward-fab";

import { SupportView } from "@/components/support/support-view";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHud } from "@/components/user-hud";
import { listFaq, listMyTickets } from "@/lib/support/queries";
import { getViewerUser } from "@/lib/auth/viewer";

export const metadata = {
  title: "Destek — GençLİG",
};

export default async function SupportPage() {
  const user = await getViewerUser();

  if (!user) {
    redirect("/giris?next=/destek");
  }

  const [faq, tickets] = await Promise.all([listFaq(), listMyTickets()]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHud title="Destek" />

      <main className="flex-1 px-4 py-4 has-bottom-nav">
        <SupportView faq={faq} tickets={tickets} />
      </main>
      <RewardFab />


      <UserBottomNav active="profile" />
    </div>
  );
}
