import { AdminShell } from "@/components/panel/admin-shell";
import { NoAccess } from "@/components/panel/panel-shell";
import { SeasonEditor } from "@/components/panel/season-editor";
import type { AdminSeasonRow } from "@/lib/seasons/admin";
import { isSuperAdmin } from "@/lib/panel/guard";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Sezonlar — GençLİG Admin" };

export default async function AdminSeasonsPage() {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  const supabase = await createClient();

  const { data } = await supabase
    .from("seasons")
    .select("id,name,starts_at,ends_at,theme,status,badge_awarded")
    .order("starts_at", { ascending: false });

  const seasons = (data ?? []) as AdminSeasonRow[];

  return (
    <AdminShell subtitle={`${seasons.length} sezon`}>
      <p className="mb-4 rounded-xl border border-edge bg-card px-3.5 py-2.5 text-xs text-ink-muted">
        Sezon bittiğinde, o aralıkta{" "}
        <strong className="text-ink">en az bir onaylı görev</strong> yapan
        herkese katılım rozeti verilir — bir kez. Bu bir başarı rozeti değil,
        &quot;o sezonda buradaydım&quot; rozetidir. Dağıtım günde bir otomatik
        çalışır; düğme yalnızca beklemeyi kısaltır. Sezon{" "}
        <strong className="text-ink">silinemez</strong>: silmek, rozeti almış
        kullanıcıların rozetini de yok ederdi.
      </p>

      <SeasonEditor seasons={seasons} />
    </AdminShell>
  );
}
