import Link from "next/link";

import { Countdown } from "./countdown";
import { Icon } from "@/components/ui/icon";
import {
  CoinPill,
  DifficultyDots,
  IconBadge,
  TimerPill,
  XpPill,
} from "@/components/ui/pills";
import {
  CATEGORY_TONE,
  CATEGORY_TONE_FALLBACK,
  SUBMISSION_STATUS_LABEL,
  TASK_TYPE_LABEL,
} from "@/lib/tasks/labels";
import type { SubmissionSummary, TaskRow } from "@/lib/tasks/queries";

/** XP ve coin rozetleri; ortak hap bileşenlerini kullanır. */
export function RewardBadges({ xp, coin }: { xp: number; coin: number }) {
  return (
    <div className="flex items-center gap-2">
      <XpPill value={xp} />
      <CoinPill value={coin} />
    </div>
  );
}

/**
 * Görevin amblem ikonu: önce görevin kendi ikonu, yoksa kategorisininki,
 * o da yoksa Icon bileşeninin varsayılanı. Data-driven olduğu için yeni
 * görev tipleri kod değişmeden farklı ikon alabiliyor.
 */
export function taskIconName(task: TaskRow): string | null {
  return task.icon ?? task.task_categories?.icon ?? null;
}

export function taskTone(task: TaskRow): string {
  return task.task_categories
    ? (CATEGORY_TONE[task.task_categories.slug] ?? CATEGORY_TONE_FALLBACK)
    : CATEGORY_TONE_FALLBACK;
}

export function TaskCard({
  task,
  submission,
}: {
  task: TaskRow;
  submission?: SubmissionSummary;
}) {
  const done = submission?.status === "approved";

  return (
    <li>
      <Link
        href={`/gorevler/${task.id}`}
        className="group flex gap-3 rounded-2xl border border-edge bg-card p-3.5 transition-all hover:border-primary/60 hover:shadow-sm active:scale-[0.99]"
      >
        <IconBadge icon={taskIconName(task)} tone={taskTone(task)} />

        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink-muted">
            {task.task_categories ? (
              <span className="truncate">{task.task_categories.name}</span>
            ) : null}
            <span aria-hidden>·</span>
            <span>{TASK_TYPE_LABEL[task.type] ?? task.type}</span>
            <DifficultyDots difficulty={task.difficulty} className="ml-0.5" />
          </span>

          <span className="truncate text-sm font-semibold text-ink">
            {task.title}
          </span>

          <span className="flex flex-wrap items-center gap-2">
            <XpPill value={task.xp} />
            <CoinPill value={task.coin} />
            {task.ends_at ? (
              <TimerPill>
                <Countdown
                  endsAt={task.ends_at}
                  initialLabel={task.remainingLabel ?? ""}
                />
              </TimerPill>
            ) : null}
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end justify-between">
          {submission ? (
            <span
              className={
                done
                  ? "inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary"
                  : "inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-muted"
              }
            >
              {done ? <Icon name="check" className="h-3 w-3" /> : null}
              {SUBMISSION_STATUS_LABEL[submission.status] ?? submission.status}
            </span>
          ) : (
            <span />
          )}

          <Icon
            name="chevron-right"
            className="h-4 w-4 text-ink-muted transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </Link>
    </li>
  );
}
