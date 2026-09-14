import { redirect } from "next/navigation";

import { TeamView } from "@/components/teams/team-view";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHeader } from "@/components/user-header";
import { createClient } from "@/lib/supabase/server";
import { getMyTeam, getMyTeamMembers } from "@/lib/teams/queries";

export const metadata = {
  title: "Takımım — GençLİG",
};

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/giris?next=/takim");
  }

  const team = await getMyTeam();
  // Takım yoksa üye sorgusu boş dönerdi; gereksiz turu atlıyoruz.
  const members = team ? await getMyTeamMembers() : [];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHeader title="Takımım" signedIn />

      <main className="flex-1 px-4 py-4">
        <TeamView team={team} members={members} />
      </main>

      <UserBottomNav active="profile" />
    </div>
  );
}
