import { redirect } from "next/navigation";

import { FriendsView } from "@/components/social/friends-view";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHeader } from "@/components/user-header";
import { listFriendRequests, listFriends } from "@/lib/social/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Arkadaşlar — GençLİG",
};

export default async function FriendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/giris?next=/arkadaslar");
  }

  const [friends, requests] = await Promise.all([
    listFriends(),
    listFriendRequests(),
  ]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHeader title="Arkadaşlar" signedIn />

      <main className="flex-1 px-4 py-4">
        <FriendsView friends={friends} requests={requests} />
      </main>

      <UserBottomNav active="profile" />
    </div>
  );
}
