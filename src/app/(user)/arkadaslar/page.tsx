import { redirect } from "next/navigation";
import { RewardFab } from "@/components/rewards/reward-fab";

import { FriendsView } from "@/components/social/friends-view";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHud } from "@/components/user-hud";
import { listFriendRequests, listFriends } from "@/lib/social/queries";
import { getViewerUser } from "@/lib/auth/viewer";

export const metadata = {
  title: "Arkadaşlar — GençLİG",
};

export default async function FriendsPage() {
  const user = await getViewerUser();

  if (!user) {
    redirect("/giris?next=/arkadaslar");
  }

  const [friends, requests] = await Promise.all([
    listFriends(),
    listFriendRequests(),
  ]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHud title="Arkadaşlar" />

      <main className="flex-1 px-4 py-4 has-bottom-nav">
        <FriendsView friends={friends} requests={requests} />
      </main>
      <RewardFab />


      <UserBottomNav active="profile" />
    </div>
  );
}
