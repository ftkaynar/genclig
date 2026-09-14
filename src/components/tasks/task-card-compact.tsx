import Link from "next/link";

import { taskIconName, taskTone } from "./task-card";
import { CoinPill, IconBadge, XpPill } from "@/components/ui/pills";
import { TASK_TYPE_LABEL } from "@/lib/tasks/labels";
import type { TaskRow } from "@/lib/tasks/queries";

/**
 * Ana sayfadaki yatay şeritte kullanılan dar görev kartı.
 *
 * Geri sayım bilerek yok: şeritteki kart zaten dar ve her kartta ayrı bir
 * zamanlayıcı çalıştırmak, kullanıcı o kartlara bakmıyorken bile sürekli
 * yeniden render demekti. Kalan süre görev listesinde ve detayda duruyor.
 */
export function TaskCardCompact({ task }: { task: TaskRow }) {
  return (
    <li className="w-[210px] shrink-0 snap-start">
      <Link
        href={`/gorevler/${task.id}`}
        className="flex h-full flex-col gap-2.5 rounded-2xl border border-edge bg-card p-3.5 transition-all hover:border-primary/60 hover:shadow-sm active:scale-[0.99]"
      >
        <IconBadge icon={taskIconName(task)} tone={taskTone(task)} />

        <span className="text-[11px] font-medium text-ink-muted">
          {task.task_categories?.name ?? "Görev"} ·{" "}
          {TASK_TYPE_LABEL[task.type] ?? task.type}
        </span>

        <span className="line-clamp-2 text-sm font-semibold leading-snug text-ink">
          {task.title}
        </span>

        <span className="mt-auto flex flex-wrap items-center gap-1.5">
          <XpPill value={task.xp} />
          <CoinPill value={task.coin} unit={false} />
        </span>
      </Link>
    </li>
  );
}
