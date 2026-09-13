import { NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { LevelEditor } from "@/components/panel/level-editor";
import { ADMIN_NAV } from "@/lib/panel/nav";
import { isSuperAdmin } from "@/lib/panel/guard";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Seviyeler — GençLİG Admin" };

export default async function AdminLevelsPage() {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("levels")
    .select("level,min_xp")
    .order("level")
    .limit(50);

  const levels = (data ?? []) as { level: number; min_xp: number }[];

  return (
    <PanelShell
      title="GençLİG Süper Admin"
      subtitle="Seviye eşikleri. Değişiklik anında geçerli olur; kullanıcıların seviyesi yeni eşiklere göre yeniden hesaplanır."
      nav={ADMIN_NAV}
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        {levels.map((row, index) => (
          <li
            key={row.level}
            className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-card px-3.5 py-2.5"
          >
            <span className="text-sm font-semibold text-ink">
              Seviye {row.level}
            </span>
            <span className="text-xs text-ink-muted">
              {row.min_xp} XP
              {index < levels.length - 1
                ? ` · aralık ${levels[index + 1].min_xp - row.min_xp}`
                : null}
            </span>
            <LevelEditor level={row.level} minXp={row.min_xp} />
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}
