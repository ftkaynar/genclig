import Link from "next/link";

import { NoAccess } from "@/components/panel/panel-shell";
import { AdminShell } from "@/components/panel/admin-shell";
import { AdminTicketList } from "@/components/support/admin-ticket-list";
import { isSuperAdmin } from "@/lib/panel/guard";
import { listAllTickets } from "@/lib/support/queries";

export const metadata = { title: "Destek — GençLİG Admin" };

const FILTERS = [
  { key: "", label: "Tümü" },
  { key: "open", label: "Yanıt bekliyor" },
  { key: "answered", label: "Yanıtlandı" },
  { key: "closed", label: "Kapatıldı" },
] as const;

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string }>;
}) {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  const { durum } = await searchParams;
  const active = FILTERS.some((item) => item.key === durum)
    ? (durum ?? "")
    : "";

  const tickets = await listAllTickets(active || undefined);

  return (
    <AdminShell subtitle={`Destek talepleri: ${tickets.length}`}>
      <nav aria-label="Durum" className="mb-4">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <li key={item.key || "all"}>
              <Link
                href={
                  item.key ? `/admin/destek?durum=${item.key}` : "/admin/destek"
                }
                aria-current={item.key === active ? "page" : undefined}
                className={
                  item.key === active
                    ? "block rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white"
                    : "block rounded-full border border-edge bg-card px-3.5 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
                }
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <AdminTicketList tickets={tickets} />
    </AdminShell>
  );
}
