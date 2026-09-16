import { AnnouncementComposer } from "@/components/announcements/announcement-composer";
import { NoAccess } from "@/components/panel/panel-shell";
import { AdminShell } from "@/components/panel/admin-shell";
import { listAnnouncements } from "@/lib/announcements/queries";
import { isSuperAdmin } from "@/lib/panel/guard";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Duyurular — GençLİG Admin" };

export default async function AdminAnnouncementsPage() {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  const supabase = await createClient();

  const [announcements, { data: municipalities }] = await Promise.all([
    listAnnouncements(null),
    supabase.from("municipalities").select("id,name").order("name"),
  ]);

  return (
    <AdminShell subtitle={`Gönderilen duyurular: ${announcements.length}`}>
      <AnnouncementComposer
        announcements={announcements}
        municipalities={municipalities ?? []}
        isSuper
      />
    </AdminShell>
  );
}
