import { NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { ReviewQueue } from "@/components/panel/review-queue";
import { ADMIN_NAV } from "@/lib/panel/nav";
import { isSuperAdmin } from "@/lib/panel/guard";
import { listPendingReviews } from "@/lib/panel/queries";

export const metadata = { title: "İncelemeler — GençLİG Admin" };

export default async function AdminReviewsPage() {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  // null = global görevlerin kuyruğu; belediye görevleri kendi panelinde.
  const items = await listPendingReviews(null);

  return (
    <PanelShell
      title="GençLİG Süper Admin"
      subtitle={`Global görevlerin bekleyen teslimleri: ${items.length}`}
      nav={ADMIN_NAV}
    >
      <ReviewQueue items={items} />
    </PanelShell>
  );
}
