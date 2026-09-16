import { SkeletonHero, SkeletonList } from "@/components/ui/skeleton";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHudSkeleton } from "@/components/user-hud";

/*
  Ana sayfa yükleme iskeleti.

  Üst bar ve alt gezinme gerçek bileşenler: yükleme sırasında yerlerinden
  oynamasınlar, yoksa veri gelince sayfa zıplıyordu.
*/
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHudSkeleton />

      <main className="flex-1 px-4 pb-4 has-bottom-nav">
        <div className="mt-3">
          <SkeletonHero />
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <span
              key={index}
              aria-hidden
              className="skeleton block h-[76px] rounded-2xl"
            />
          ))}
        </div>

        <div className="mt-4">
          <SkeletonList count={3} />
        </div>
      </main>


      <UserBottomNav active="home" />
    </div>
  );
}
