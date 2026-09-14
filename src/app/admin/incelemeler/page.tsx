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

  /*
    "all": süper admin TÜM belediyelerin + global görevlerin bekleyen
    tesliminlerini görür. Önceki sürüm null geçiyordu ve yalnızca global
    görevleri listeliyordu — belediye görevlerine gelen fotoğraflar süper
    adminin kuyruğunda hiç görünmüyordu (D24 FAZ T).
  */
  const items = await listPendingReviews("all");

  return (
    <PanelShell
      title="GençLİG Süper Admin"
      subtitle={`Bekleyen teslim (tüm belediyeler + global): `}
      nav={ADMIN_NAV}
    >
      <ReviewQueue items={items} />
    </PanelShell>
  );
}
