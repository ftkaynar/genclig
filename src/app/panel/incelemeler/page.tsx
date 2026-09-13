import { NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { ReviewQueue } from "@/components/panel/review-queue";
import { PANEL_NAV } from "@/lib/panel/nav";
import { getPanelContext } from "@/lib/panel/guard";
import { listPendingReviews } from "@/lib/panel/queries";

export const metadata = { title: "İncelemeler — GençLİG Panel" };

export default async function PanelReviewsPage() {
  const context = await getPanelContext();
  if (!context) {
    return <NoAccess message="Bu sayfa belediye personeline açıktır." />;
  }

  const items = await listPendingReviews(context.municipalityId);

  return (
    <PanelShell
      title="GençLİG Belediye Paneli"
      subtitle={`${context.municipalityName} · bekleyen inceleme: ${items.length}`}
      nav={PANEL_NAV}
    >
      <ReviewQueue items={items} />
    </PanelShell>
  );
}
