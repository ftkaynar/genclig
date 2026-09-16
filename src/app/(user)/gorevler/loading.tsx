import { SkeletonChips, SkeletonList } from "@/components/ui/skeleton";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHudSkeleton } from "@/components/user-hud";

/*
  Yükleme iskeleti.

  Sunucu bileşeni veriyi beklerken sayfanın şekli görünüyor. Üst bar ve alt
  gezinme gerçek bileşenler: yükleme sırasında yerlerinden oynamasınlar,
  yoksa veri gelince sayfa zıplıyordu.
*/
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHudSkeleton title="Görevler" />

      <main className="flex-1 px-4 py-4 has-bottom-nav">
        <SkeletonChips count={3} />
        <div className="mt-2">
          <SkeletonChips count={3} />
        </div>
        <div className="mt-4">
          <SkeletonList count={5} />
        </div>
      </main>

      <UserBottomNav active="tasks" />
    </div>
  );
}
