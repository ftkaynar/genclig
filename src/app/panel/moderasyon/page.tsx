import { ModerationQueue } from "@/components/community/moderation-queue";
import { NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { listModerationQueue } from "@/lib/community/queries";
import { PANEL_NAV } from "@/lib/panel/nav";
import { getPanelContext } from "@/lib/panel/guard";

export const metadata = { title: "Moderasyon — GençLİG Panel" };

export default async function PanelModerationPage() {
  const context = await getPanelContext();
  if (!context) {
    return <NoAccess message="Bu sayfa belediye personeline açıktır." />;
  }

  /*
    Kuyruk zaten sunucuda filtreli: list_moderation_queue yalnızca
    çağıranın moderasyon yetkisi olan kanalları döndürüyor. Burada ayrıca
    süzmek gerekmiyor ve gerekseydi zaten client'ta yetki kararı vermek
    olurdu.
  */
  const rows = await listModerationQueue();

  return (
    <PanelShell
      title={context.municipalityName}
      subtitle={`Açık rapor: ${rows.length}`}
      nav={PANEL_NAV}
    >
      {/* Global susturma yalnızca süper adminde; personel kendi kanalıyla sınırlı. */}
      <ModerationQueue rows={rows} canMuteGlobally={false} />
    </PanelShell>
  );
}
