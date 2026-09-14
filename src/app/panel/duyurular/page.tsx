import { AnnouncementComposer } from "@/components/announcements/announcement-composer";
import { NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { listAnnouncements } from "@/lib/announcements/queries";
import { PANEL_NAV } from "@/lib/panel/nav";
import { getPanelContext } from "@/lib/panel/guard";

export const metadata = { title: "Duyurular — GençLİG Panel" };

export default async function PanelAnnouncementsPage() {
  const context = await getPanelContext();
  if (!context) {
    return <NoAccess message="Bu sayfa belediye personeline açıktır." />;
  }

  const announcements = await listAnnouncements(context.municipalityId);

  return (
    <PanelShell
      title={context.municipalityName}
      subtitle={`Gönderilen duyurular: ${announcements.length}`}
      nav={PANEL_NAV}
    >
      {/*
        Personelin hedefi sabit: kendi belediyesi. Belediye seçici hiç
        gösterilmiyor — asıl kural send_announcement içinde ve orada
        başka belediye denemesi reddediliyor (ölçüldü).
      */}
      <AnnouncementComposer
        announcements={announcements}
        municipalities={[
          { id: context.municipalityId, name: context.municipalityName },
        ]}
        isSuper={false}
        fixedMunicipalityId={context.municipalityId}
      />
    </PanelShell>
  );
}
