import { NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { EMPTY_TASK, TaskForm } from "@/components/panel/task-form";
import { PANEL_NAV } from "@/lib/panel/nav";
import { getPanelContext } from "@/lib/panel/guard";
import { getProvinces } from "@/lib/reference/queries";
import {
  getPanelDefaultArea,
  listTaskCategories,
} from "@/lib/panel/task-form-data";

export const metadata = { title: "Yeni görev — GençLİG Panel" };

export default async function NewPanelTaskPage() {
  const context = await getPanelContext();
  if (!context) {
    return <NoAccess message="Bu sayfa belediye personeline açıktır." />;
  }

  const [categories, provinces, area] = await Promise.all([
    listTaskCategories(),
    getProvinces(),
    /*
      Bölge ÖN DOLU geliyor: belediye çoğu zaman kendi bölgesi için
      görev açıyor. Kilit değil — gerekçesi task-form.tsx icinde.
    */
    getPanelDefaultArea(context.municipalityId),
  ]);

  return (
    <PanelShell
      title="GençLİG Belediye Paneli"
      subtitle={`${context.municipalityName} · yeni görev`}
      nav={PANEL_NAV}
    >
      <TaskForm
        initial={EMPTY_TASK}
        defaultArea={area}
        categories={categories}
        provinces={provinces}
        scope="panel"
      />
    </PanelShell>
  );
}
