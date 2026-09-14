import { NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { RoleManager } from "@/components/panel/role-manager";
import { ADMIN_NAV } from "@/lib/panel/nav";
import { isSuperAdmin } from "@/lib/panel/guard";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Kullanıcılar — GençLİG Admin" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ ara?: string }>;
}) {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  const { ara } = await searchParams;
  const supabase = await createClient();

  // Kullanıcı adı olmayan profiller listelenmiyor: onboarding'i bitirmemiş
  // hesabın yönetilecek bir tarafı yok.
  let query = supabase
    .from("profiles")
    .select("id,username,display_name,provinces(name)")
    .not("username", "is", null)
    .order("username")
    .limit(100);

  if (ara && ara.trim().length > 0) {
    query = query.ilike("username", `%${ara.trim()}%`);
  }

  const [{ data: profiles }, { data: roles }, { data: municipalities }] =
    await Promise.all([
      query,
      supabase.from("user_roles").select("user_id,role,municipality_id"),
      supabase.from("municipalities").select("id,name").order("name"),
    ]);

  const rows = (profiles ?? []) as unknown as {
    id: string;
    username: string;
    display_name: string | null;
    provinces: { name: string } | null;
  }[];

  const roleMap = new Map<
    string,
    { role: string; municipality_id: string | null }[]
  >();
  for (const row of roles ?? []) {
    const list = roleMap.get(row.user_id) ?? [];
    list.push({ role: row.role, municipality_id: row.municipality_id });
    roleMap.set(row.user_id, list);
  }

  return (
    <PanelShell
      title="GençLİG Süper Admin"
      subtitle={`${rows.length} kullanıcı listeleniyor`}
      nav={ADMIN_NAV}
    >
      <form className="mb-4 flex gap-2" action="/admin/kullanicilar">
        <input
          name="ara"
          defaultValue={ara ?? ""}
          placeholder="Kullanıcı adı ara"
          className="flex-1 rounded-xl border border-edge bg-surface px-3.5 py-2 text-sm text-ink"
        />
        <button
          type="submit"
          className="rounded-full bg-cta px-4 py-2 text-sm font-semibold text-white"
        >
          Ara
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-ink-muted">
          Kullanıcı bulunamadı.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((profile) => (
            <li
              key={profile.id}
              className="rounded-2xl border border-edge bg-card p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {profile.username}
                  </span>
                  <span className="block text-[11px] text-ink-muted">
                    {profile.display_name ?? "—"}
                    {profile.provinces ? ` · ${profile.provinces.name}` : null}
                  </span>
                </span>
                <span className="flex flex-wrap gap-1">
                  {(roleMap.get(profile.id) ?? []).map((role, index) => (
                    <span
                      key={`${role.role}-${index}`}
                      className="rounded-full bg-xp/15 px-2 py-0.5 text-[10px] font-semibold text-xp"
                    >
                      {role.role}
                    </span>
                  ))}
                </span>
              </div>

              <RoleManager
                userId={profile.id}
                municipalities={
                  (municipalities ?? []) as { id: string; name: string }[]
                }
              />
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}
