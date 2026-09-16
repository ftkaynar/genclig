import { NoAccess } from "@/components/panel/panel-shell";
import { AdminShell } from "@/components/panel/admin-shell";
import { ReviewQueue } from "@/components/panel/review-queue";
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
    <AdminShell subtitle={`Bekleyen teslim (tüm belediyeler + global): `}>
      <ReviewQueue items={items} />
    </AdminShell>
  );
}
