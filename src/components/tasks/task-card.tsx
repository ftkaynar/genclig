import Link from "next/link";

import { Countdown } from "./countdown";
import {
  CATEGORY_TONE,
  CATEGORY_TONE_FALLBACK,
  DIFFICULTY_LABEL,
  SUBMISSION_STATUS_LABEL,
  TASK_TYPE_LABEL,
} from "@/lib/tasks/labels";
import type { SubmissionSummary, TaskRow } from "@/lib/tasks/queries";

/** XP ve coin rozetleri; renkler D04 token'larından. */
export function RewardBadges({ xp, coin }: { xp: number; coin: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-xp/15 px-2.5 py-1 text-xs font-semibold text-xp">
        +{xp} XP
      </span>
      <span className="rounded-full bg-coin/15 px-2.5 py-1 text-xs font-semibold text-coin">
        +{coin} Coin
      </span>
    </div>
  );
}

export function TaskCard({
  task,
  submission,
}: {
  task: TaskRow;
  submission?: SubmissionSummary;
}) {
  const tone = task.task_categories
    ? (CATEGORY_TONE[task.task_categories.slug] ?? CATEGORY_TONE_FALLBACK)
    : CATEGORY_TONE_FALLBACK;

  return (
    <li>
      <Link
        href={`/gorevler/${task.id}`}
        className="flex gap-3 rounded-2xl border border-edge bg-card p-3 transition-colors hover:border-primary/60"
      >
        {/* Görsel yoksa kategoriye göre marka renkli blok. */}
        <span
          aria-hidden
          className={`h-16 w-16 shrink-0 rounded-xl bg-gradient-to-br ${tone}`}
        />

        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center gap-2 text-[11px] font-medium text-ink-muted">
            {task.task_categories ? <span>{task.task_categories.name}</span> : null}
            <span aria-hidden>·</span>
            <span>{TASK_TYPE_LABEL[task.type] ?? task.type}</span>
            <span aria-hidden>·</span>
            <span>{DIFFICULTY_LABEL[task.difficulty] ?? task.difficulty}</span>
          </span>

          <span className="truncate text-sm font-semibold text-ink">
            {task.title}
          </span>

          <RewardBadges xp={task.xp} coin={task.coin} />

          {task.ends_at ? (
            <Countdown
              endsAt={task.ends_at}
              initialLabel={task.remainingLabel ?? ""}
              className="text-[11px] font-medium text-status-warning"
            />
          ) : null}
        </span>

        {submission ? (
          <span className="self-start rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-muted">
            {SUBMISSION_STATUS_LABEL[submission.status] ?? submission.status}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
