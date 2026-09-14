import Link from "next/link";
import { notFound } from "next/navigation";

import { Countdown } from "@/components/tasks/countdown";
import { RewardBadges } from "@/components/tasks/task-card";
import { NotificationBell } from "@/components/notifications/bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Icon } from "@/components/ui/icon";
import { UserBottomNav } from "@/components/user-bottom-nav";
import {
  CATEGORY_TONE,
  CATEGORY_TONE_FALLBACK,
  DIFFICULTY_LABEL,
  SUBMISSION_STATUS_LABEL,
  TASK_TYPE_LABEL,
  VERIFICATION_LABEL,
} from "@/lib/tasks/labels";
import { SubmitTask } from "@/components/tasks/submit-task";
import {
  getParticipantCount,
  getSubmissionMap,
  getTask,
  getViewer,
} from "@/lib/tasks/queries";

/** Detay satırı: solda etiket, sağda değer. */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-edge py-2.5 last:border-b-0">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-right text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const task = await getTask(id);
  if (!task) {
    notFound();
  }

  const viewer = await getViewer();
  const submissions = await getSubmissionMap([task.id]);
  const submission = submissions.get(task.id);

  const participantCount =
    task.capacity !== null ? await getParticipantCount(task.id) : null;

  /*
    Buton yalnızca açık bir teslim yokken görünür. Reddedilen teslim tekrar
    denemeyi engellemiyor; kısıt da (task_submissions_open_unique) yalnızca
    beklemedeki ve onaylanmış satırları kapsıyor.
  */
  const hasOpenSubmission =
    submission?.status === "pending" || submission?.status === "approved";

  const tone = task.task_categories
    ? (CATEGORY_TONE[task.task_categories.slug] ?? CATEGORY_TONE_FALLBACK)
    : CATEGORY_TONE_FALLBACK;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <header className="flex items-center justify-between px-4 pt-4">
        <Link
          href="/gorevler"
          className="text-sm font-medium text-ink-muted hover:text-ink"
        >
          ← Görevler
        </Link>
        <div className="flex items-center gap-2">
          {viewer ? <NotificationBell /> : null}
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 px-4 py-4">
        {/* Kapak: görsel yoksa kategoriye göre marka renkli blok. */}
        <div
          aria-hidden
          className={`h-36 w-full rounded-2xl bg-gradient-to-br ${tone}`}
          style={
            task.image_url
              ? {
                  backgroundImage: `url(${task.image_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        />

        <div className="mt-4 flex items-center gap-2 text-[11px] font-medium text-ink-muted">
          {task.task_categories ? <span>{task.task_categories.name}</span> : null}
          <span aria-hidden>·</span>
          <span>{TASK_TYPE_LABEL[task.type] ?? task.type}</span>
        </div>

        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-ink">
          {task.title}
        </h1>

        <p className="mt-2 text-sm text-ink-muted">{task.description}</p>

        <div className="mt-4">
          <RewardBadges xp={task.xp} coin={task.coin} />
        </div>

        {task.scope === "team" ? (
          <div className="mt-4 rounded-2xl border border-magenta/40 bg-magenta/10 p-3.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-magenta">
              <Icon name="users" className="h-4 w-4" />
              Takım görevi
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Takımından en az {task.min_team_size ?? 2} kişi tamamladığında
              eşiği sağlayan herkese +{task.team_bonus_xp} XP ve
              +{task.team_bonus_coin} coin bonus yazılır.
            </p>
          </div>
        ) : null}

        {task.ends_at ? (
          <p className="mt-3 text-sm font-semibold text-status-warning">
            <Countdown
              endsAt={task.ends_at}
              initialLabel={task.remainingLabel ?? ""}
            />
          </p>
        ) : null}

        {submission ? (
          <p className="mt-4 rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink">
            Durum:{" "}
            <span className="font-semibold">
              {SUBMISSION_STATUS_LABEL[submission.status] ?? submission.status}
            </span>
            {submission.status === "rejected" ? (
              <span className="mt-1 block text-xs text-ink-muted">
                Bu görevi yeniden deneyebilirsin.
              </span>
            ) : null}
          </p>
        ) : null}

        <section className="mt-5 rounded-2xl border border-edge bg-card px-4 py-2">
          <DetailRow
            label="Doğrulama"
            value={VERIFICATION_LABEL[task.verification] ?? task.verification}
          />
          <DetailRow
            label="Zorluk"
            value={DIFFICULTY_LABEL[task.difficulty] ?? task.difficulty}
          />
          {task.lat !== null && task.lng !== null ? (
            <DetailRow
              label="Hedef konum"
              value={`${task.lat.toFixed(5)}, ${task.lng.toFixed(5)}${
                task.radius_m ? ` · ${task.radius_m} m yarıçap` : ""
              }`}
            />
          ) : null}
          {task.capacity !== null ? (
            <DetailRow
              label="Katılım"
              value={`${participantCount ?? 0}/${task.capacity}`}
            />
          ) : null}
        </section>

        {task.instructions ? (
          <section className="mt-4 rounded-2xl border border-edge bg-card p-4">
            <h2 className="text-sm font-semibold text-ink">Nasıl yapılır</h2>
            <p className="mt-1.5 text-sm text-ink-muted">{task.instructions}</p>
          </section>
        ) : null}

        <div className="mt-6">
          {viewer ? (
            hasOpenSubmission ? (
              <p className="rounded-xl border border-edge bg-card px-3.5 py-3 text-center text-sm text-ink-muted">
                {submission?.status === "approved"
                  ? "Bu görevi tamamladın."
                  : "Teslimin incelemeye alındı."}
              </p>
            ) : (
              <SubmitTask
                taskId={task.id}
                userId={viewer.id}
                verification={task.verification}
                xp={task.xp}
                coin={task.coin}
              />
            )
          ) : (
            <Link
              href={`/giris?next=/gorevler/${task.id}`}
              className="block w-full rounded-full bg-cta px-6 py-3 text-center text-base font-semibold text-white"
            >
              Göreve başlamak için giriş yap
            </Link>
          )}
        </div>
      </main>

      <UserBottomNav active="tasks" />
    </div>
  );
}
