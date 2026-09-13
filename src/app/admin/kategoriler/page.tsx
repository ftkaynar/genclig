import { NoAccess, PanelShell } from "@/components/panel/panel-shell";
import {
  ProblemCategoryCreator,
  TaskCategoryCreator,
} from "@/components/panel/admin-editors";
import { ADMIN_NAV } from "@/lib/panel/nav";
import { isSuperAdmin } from "@/lib/panel/guard";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Kategoriler — GençLİG Admin" };

export default async function AdminCategoriesPage() {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  const supabase = await createClient();

  const [{ data: taskCategories }, { data: problemCategories }] =
    await Promise.all([
      supabase.from("task_categories").select("id,slug,name,sort").order("sort"),
      supabase
        .from("problem_categories")
        .select("id,slug,name,sort")
        .order("sort"),
    ]);

  const renderList = (
    rows: { id: number; slug: string; name: string; sort: number }[],
  ) => (
    <ul className="mt-3 flex flex-col gap-2">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-card px-3.5 py-2.5"
        >
          <span className="text-sm text-ink">{row.name}</span>
          <span className="text-[11px] text-ink-muted">
            {row.slug} · sıra {row.sort}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <PanelShell title="GençLİG Süper Admin" nav={ADMIN_NAV}>
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">Görev kategorileri</h2>
          <TaskCategoryCreator />
        </div>
        {renderList(
          (taskCategories ?? []) as {
            id: number;
            slug: string;
            name: string;
            sort: number;
          }[],
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">
            Bildirim kategorileri
          </h2>
          <ProblemCategoryCreator />
        </div>
        {renderList(
          (problemCategories ?? []) as {
            id: number;
            slug: string;
            name: string;
            sort: number;
          }[],
        )}
      </section>
    </PanelShell>
  );
}
