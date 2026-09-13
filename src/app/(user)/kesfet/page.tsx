import { DiscoverView } from "@/components/discover/discover-view";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHeader } from "@/components/user-header";
import { listDiscoverTasks } from "@/lib/discover/queries";
import { getViewer } from "@/lib/tasks/queries";

export const metadata = {
  title: "Keşfet — GençLİG",
};

export default async function DiscoverPage() {
  const [tasks, viewer] = await Promise.all([
    listDiscoverTasks(),
    getViewer(),
  ]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHeader title="Keşfet" signedIn={Boolean(viewer)} />

      <main className="flex-1 px-4 py-4">
        <DiscoverView tasks={tasks} />
      </main>

      <UserBottomNav active="discover" />
    </div>
  );
}
