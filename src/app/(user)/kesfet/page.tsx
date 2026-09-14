import { DiscoverView } from "@/components/discover/discover-view";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHud } from "@/components/user-hud";
import { getViewerProfile } from "@/lib/auth/viewer";
import { getDistrictStats } from "@/lib/discover/queries";
import { getTaskCategories } from "@/lib/reference/queries";
import { getSubmissionMap, listFeedTasks } from "@/lib/tasks/queries";
import type { SubmissionSummary } from "@/lib/tasks/queries";

export const metadata = {
  title: "Keşfet — GençLİG",
};

export default async function DiscoverPage() {
  /*
    Keşfet artık tam görev satırlarını kullanıyor (ayrı DiscoverTask
    şekli yerine): şeritler /gorevler ile aynı TaskTile bileşenini
    render ediyor ve kutucuk zaman durumu, zorluk, takım bilgisi gibi
    alanlara ihtiyaç duyuyor. Harita hâlâ hafif şekli alıyor.
  */
  const tasks = await listFeedTasks();

  const [submissionMap, categories, stats] = await Promise.all([
    getSubmissionMap(tasks.map((task) => task.id)),
    getTaskCategories(),
    getDistrictStats(),
  ]);

  const profile = await getViewerProfile();

  // Map, client bileşenine serileştirilemiyor; düz nesneye çevriliyor.
  const submissions: Record<string, SubmissionSummary> = {};
  for (const [id, value] of submissionMap) submissions[id] = value;

  const mapTasks = tasks
    .filter((task) => task.lat !== null && task.lng !== null)
    .map((task) => ({
      id: task.id,
      title: task.title,
      lat: task.lat as number,
      lng: task.lng as number,
      xp: task.xp,
      coin: task.coin,
      categorySlug: task.task_categories?.slug ?? null,
      categoryName: task.task_categories?.name ?? null,
    }));

  // Yalnızca görevi olan kategoriler filtre çipi olarak gösteriliyor.
  const usedSlugs = new Set(
    tasks.map((task) => task.task_categories?.slug).filter(Boolean),
  );
  const filterCategories = categories
    .filter((category) => usedSlugs.has(category.slug))
    .map((category) => ({ slug: category.slug, name: category.name }));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHud title="Keşfet" />

      <main className="flex-1 px-4 py-4">
        <DiscoverView
          tasks={tasks}
          mapTasks={mapTasks}
          submissions={submissions}
          categories={filterCategories}
          stats={stats}
          hasLocation={Boolean(profile?.district_id)}
        />
      </main>

      <UserBottomNav active="discover" />
    </div>
  );
}
