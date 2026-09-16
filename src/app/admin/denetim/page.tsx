import { AdminShell } from "@/components/panel/admin-shell";
import { NoAccess } from "@/components/panel/panel-shell";
import { AuditFilters, AuditTable } from "@/components/panel/audit-feed";
import { isSuperAdmin } from "@/lib/panel/guard";
import { listAuditActions, listAuditLogs } from "@/lib/panel/queries";

export const metadata = { title: "Denetim — GençLİG" };

/*
  Denetim izi.

  Yalnız süper admine açık; kısıt burada DEĞİL, audit_logs RLS
  politikasında duruyor (audit_logs_select_super). Buradaki guard
  yalnızca yetkisiz kullanıcıya boş tablo yerine açıklayıcı ekran
  göstermek için — gizlilik sınırı tek yerde kalsın.
*/
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ aksiyon?: string; baslangic?: string; bitis?: string }>;
}) {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Denetim izi yalnızca süper adminlere açıktır." />;
  }

  const { aksiyon, baslangic, bitis } = await searchParams;

  const [rows, actions] = await Promise.all([
    listAuditLogs({
      action: aksiyon || undefined,
      from: baslangic || undefined,
      // Bitiş günü DAHİL olmalı: kullanıcı "1 Ocak"ı seçtiğinde o günün
      // kayıtlarını bekliyor, gece yarısına kadar olanları değil.
      to: bitis ? `${bitis}T23:59:59` : undefined,
      limit: 300,
    }),
    listAuditActions(),
  ]);

  return (
    <AdminShell subtitle={`${rows.length} kayıt listeleniyor`}>
      <AuditFilters
        actions={actions}
        current={{ action: aksiyon, from: baslangic, to: bitis }}
      />
      <AuditTable rows={rows} />
    </AdminShell>
  );
}
