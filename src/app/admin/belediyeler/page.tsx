import { NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { MunicipalityEditor } from "@/components/panel/municipality-editor";
import { ADMIN_NAV } from "@/lib/panel/nav";
import { isSuperAdmin } from "@/lib/panel/guard";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Belediyeler — GençLİG Admin" };

export default async function AdminMunicipalitiesPage() {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  const supabase = await createClient();

  const [{ data: municipalities }, { data: provinces }] = await Promise.all([
    supabase
      .from("municipalities")
      .select("id,name,slug,level,status,provinces(name),districts(name)")
      .order("name"),
    supabase.from("provinces").select("id,name").order("name"),
  ]);

  const rows = (municipalities ?? []) as unknown as {
    id: string;
    name: string;
    slug: string;
    level: string;
    status: string;
    provinces: { name: string } | null;
    districts: { name: string } | null;
  }[];

  return (
    <PanelShell
      title="GençLİG Süper Admin"
      subtitle={`${rows.length} belediye`}
      nav={ADMIN_NAV}
    >
      <div className="mb-4">
        <MunicipalityEditor
          provinces={(provinces ?? []) as { id: number; name: string }[]}
        />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-ink-muted">
          Henüz belediye eklenmemiş.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {rows.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-edge bg-card p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">
                  {item.name}
                </span>
                <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-muted">
                  {item.status}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-ink-muted">
                {item.slug} · {item.level}
                {item.provinces ? ` · ${item.provinces.name}` : null}
                {item.districts ? ` / ${item.districts.name}` : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}
