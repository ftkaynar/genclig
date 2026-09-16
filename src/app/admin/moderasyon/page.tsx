import { ModerationQueue } from "@/components/community/moderation-queue";
import { NoAccess } from "@/components/panel/panel-shell";
import { AdminShell } from "@/components/panel/admin-shell";
import { Icon } from "@/components/ui/icon";
import { listModerationQueue } from "@/lib/community/queries";
import { isSuperAdmin } from "@/lib/panel/guard";
import { listAuditLogs } from "@/lib/panel/queries";

export const metadata = { title: "Moderasyon — GençLİG Admin" };

function when(value: string): string {
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminModerationPage() {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  /*
    Silinen mesajlar denetim izinden okunuyor, channel_messages'tan değil.

    Neden: silme kaydı zaten audit_logs'a GÖVDESİYLE düşüyor (M28) ve
    orada "kim sildi" bilgisi de var. Aynı bilgiyi channel_messages
    üzerinden kurmak, deleted_by için ikinci bir profil sorgusu ve
    kanal/il filtresi demekti; iki kaynak tutmak da zamanla ayrışırdı.

    Yalnız süper admine açık: audit_logs RLS'i başka kimseyi geçirmiyor.
  */
  const [rows, deleted] = await Promise.all([
    listModerationQueue(),
    listAuditLogs({ action: "message.delete", limit: 50 }),
  ]);

  return (
    <AdminShell
      subtitle={`Açık rapor: ${rows.length} · Son silinen: ${deleted.length}`}
    >
      <ModerationQueue rows={rows} canMuteGlobally />

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Icon name="trash-2" className="h-4 w-4 text-status-danger" />
          Silinen mesajlar
          <span className="font-normal text-ink-muted">
            — içerik ve kim sildiği
          </span>
        </h2>

        {deleted.length === 0 ? (
          <p className="rounded-2xl border border-edge bg-card px-4 py-6 text-center text-sm text-ink-muted">
            Henüz silinmiş mesaj yok.
          </p>
        ) : (
          <ul className="divide-y divide-edge overflow-hidden rounded-2xl border border-edge bg-card">
            {deleted.map((row, i) => (
              <li
                key={row.id}
                className="tile-stagger px-3.5 py-3 transition-colors hover:bg-surface"
                style={{ "--i": i } as React.CSSProperties}
              >
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-muted">
                  <span className="rounded-full bg-status-danger/15 px-2 py-0.5 font-semibold text-status-danger">
                    {row.actor_username ?? "sistem"} sildi
                  </span>
                  <span className="tabular-nums">{when(row.created_at)}</span>
                </p>

                {/*
                  Silinen metin alıntı olarak gösteriliyor ve stil olarak
                  ayrıştırılıyor: panelde okunan bir metnin hâlâ yayında
                  olduğu izlenimi vermemeli.
                */}
                <p className="mt-1.5 border-l-2 border-edge pl-2.5 text-[13px] italic text-ink">
                  {typeof row.meta.body === "string" && row.meta.body.length > 0
                    ? row.meta.body
                    : "(içerik kaydedilmemiş)"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
