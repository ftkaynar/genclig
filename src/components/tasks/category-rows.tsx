import Link from "next/link";

import { TaskTile } from "./task-tile";
import { HScroll } from "@/components/ui/h-scroll";
import { Icon } from "@/components/ui/icon";
import type { SubmissionSummary, TaskRow } from "@/lib/tasks/queries";

/*
  Kategori satırları (D35 FAZ G).

  ÖNCEKİ DURUM: /gorevler "Tümü" görünümü tek bir düz ızgaraydı. Onlarca
  görev kategori ayrımı olmadan alt alta diziliyordu; kullanıcı "çevre
  görevi var mı" sorusunu ancak hepsini tarayarak yanıtlayabiliyordu.
  Keşfet'te kategori şeritleri zaten vardı — aynı veri iki ekranda iki
  ayrı düzende duruyordu.

  Artık her kategori bir satır: başlıkta ikon + ad + "tümünü gör",
  altında yatay TaskTile şeridi (D34 kuralları: ok düğmeli, solma
  maskesi yok).

  Görevi olmayan kategori satırı HİÇ çizilmiyor: boş bir başlık,
  "burada bir şey olmalıydı" izlenimi veriyor.
*/

export type CategoryGroup = {
  slug: string;
  name: string;
  icon: string | null;
  tasks: TaskRow[];
};

/**
 * Görevleri kategoriye göre gruplar.
 *
 * Sıra görevlerin geliş sırasından: `listFeedTasks` created_at'e göre
 * sıralı geliyor, yani en eski kategori üstte kalıyor ve liste her
 * yüklemede aynı sırada çiziliyor. Alfabetik sıralama denendi ve
 * elendi — kullanıcı sırayı ezberliyor, alfabe o ezberi kategori adı
 * değiştiğinde bozuyordu.
 */
export function groupByCategory(tasks: TaskRow[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();

  for (const task of tasks) {
    const category = task.task_categories;
    if (!category?.slug) continue;

    if (!groups.has(category.slug)) {
      groups.set(category.slug, {
        slug: category.slug,
        name: category.name,
        icon: category.icon,
        tasks: [],
      });
    }
    groups.get(category.slug)!.tasks.push(task);
  }

  return [...groups.values()];
}

export function CategoryRows({
  groups,
  submissions,
  teamProgress,
  spotlightId,
  scope,
}: {
  groups: CategoryGroup[];
  submissions: Map<string, SubmissionSummary>;
  teamProgress: Map<string, number>;
  spotlightId: string | null;
  /** Aktif kapsam çipi; "tümünü gör" bağlantısında korunuyor. */
  scope: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => {
        const href = `/gorevler?kategori=${group.slug}${
          scope ? `&kapsam=${scope}` : ""
        }`;

        return (
          <section key={group.slug}>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary-ink">
                <Icon name={group.icon ?? "list-checks"} className="h-4 w-4" />
              </span>

              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                {group.name}
              </h2>

              {/*
                "Tümünü gör" satırda ÜÇTEN FAZLA görev varken anlamlı.
                Üç kart zaten şeride sığıyor ve bağlantı aynı kartları
                ızgarada gösteriyordu — çalışan ama işe yaramayan bir
                tıklama.
              */}
              {group.tasks.length > 3 ? (
                <Link
                  href={href}
                  className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-primary-ink hover:underline"
                >
                  Tümünü gör
                  <Icon name="chevron-right" className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <span className="shrink-0 text-[11px] font-medium text-ink-muted">
                  {group.tasks.length} görev
                </span>
              )}
            </div>

            <HScroll as="ul" ariaLabel={`${group.name} görevleri`}>
              {group.tasks.map((task, i) => (
                <TaskTile
                  key={task.id}
                  task={task}
                  submission={submissions.get(task.id)}
                  teamCount={teamProgress.get(task.id)}
                  index={i}
                  small
                  spotlight={task.id === spotlightId}
                />
              ))}
            </HScroll>
          </section>
        );
      })}
    </div>
  );
}
