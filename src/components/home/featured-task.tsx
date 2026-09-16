import Link from "next/link";

import { Countdown } from "@/components/tasks/countdown";
import { taskIconName } from "@/components/tasks/task-card";
import { Icon } from "@/components/ui/icon";
import { TaskReward } from "@/components/ui/task-reward";
import type { TaskRow } from "@/lib/tasks/queries";

/**
 * "Öne çıkan görev" bandı.
 *
 * Seçim kuralı çağıran tarafta: bitişi en yakın anlık görev. Aciliyeti olan
 * tek görev öne çıkarılıyor; şeritteki beş öneri arasında kaybolmasın diye
 * gradyan kenarla ayrı bir bant olarak duruyor.
 */
export function FeaturedTask({ task }: { task: TaskRow }) {
  return (
    <section className="mt-4">
      <h2 className="mb-2 text-sm font-semibold text-ink">Öne çıkan görev</h2>

      {/* Gradyan kenar: dıştaki gradyan katman, içteki kart yüzeyi. */}
      <div className="brand-gradient anim-pop rounded-3xl p-[2px]">
        <Link
          href={`/gorevler/${task.id}`}
          className="flex items-center gap-3 rounded-[calc(1.5rem-2px)] bg-card p-4 transition-colors active:scale-[0.99]"
        >
          <span className="brand-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white">
            <Icon name={taskIconName(task)} className="h-6 w-6" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-sm font-bold leading-snug text-ink">
              {task.title}
            </span>
            <TaskReward
              xp={task.xp}
              coin={task.coin}
              size="md"
              className="mt-1.5"
            />
            {task.ends_at ? (
              <span className="mt-1.5 block text-[11px] font-semibold text-status-warning">
                <Countdown
                  endsAt={task.ends_at}
                  initialLabel={task.remainingLabel ?? ""}
                />
              </span>
            ) : null}
          </span>

          <Icon
            name="chevron-right"
            className="h-4 w-4 shrink-0 text-ink-muted"
          />
        </Link>
      </div>
    </section>
  );
}
