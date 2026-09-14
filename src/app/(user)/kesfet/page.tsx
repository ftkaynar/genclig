import { DiscoverView } from "@/components/discover/discover-view";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHud } from "@/components/user-hud";
import { listDiscoverTasks } from "@/lib/discover/queries";

export const metadata = {
  title: "Keşfet — GençLİG",
};

export default async function DiscoverPage() {
  const tasks = await listDiscoverTasks();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHud title="Keşfet" />

      <main className="flex-1 px-4 py-4">
        <DiscoverView tasks={tasks} />
      </main>

      <UserBottomNav active="discover" />
    </div>
  );
}
