import { redirect } from "next/navigation";
import { RewardFab } from "@/components/rewards/reward-fab";

import { TeamView } from "@/components/teams/team-view";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHud } from "@/components/user-hud";
import { getMyTeam, getMyTeamMembers } from "@/lib/teams/queries";
import { getViewerUser } from "@/lib/auth/viewer";

export const metadata = {
  title: "Takımım — GençLİG",
};

export default async function TeamPage() {
  const user = await getViewerUser();

  if (!user) {
    redirect("/giris?next=/takim");
  }

  const team = await getMyTeam();
  // Takım yoksa üye sorgusu boş dönerdi; gereksiz turu atlıyoruz.
  const members = team ? await getMyTeamMembers() : [];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHud title="Takımım" />

      <main className="flex-1 px-4 py-4 has-bottom-nav">
        <TeamView team={team} members={members} />
      </main>
      <RewardFab />


      <UserBottomNav active="profile" />
    </div>
  );
}
