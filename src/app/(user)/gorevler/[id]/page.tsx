import Link from "next/link";
import { RewardFab } from "@/components/rewards/reward-fab";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";

import { Countdown } from "@/components/tasks/countdown";
import { RewardBadges } from "@/components/tasks/task-card";
import { NotificationBell } from "@/components/notifications/bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Icon } from "@/components/ui/icon";
import { getSpotlightTaskId } from "@/lib/spotlight/queries";
import { getTaskQuiz } from "@/lib/quiz/queries";
import { getTeamTaskProgress } from "@/lib/teams/queries";
import { UserBottomNav } from "@/components/user-bottom-nav";
import {
  CATEGORY_TONE,
  CATEGORY_TONE_FALLBACK,
  DIFFICULTY_LABEL,
  SUBMISSION_STATUS_LABEL,
  TASK_TYPE_LABEL,
  VERIFICATION_LABEL,
  formatDateTime,
  taskCardState,
  taskIssuer,
} from "@/lib/tasks/labels";
import { QuizRunner } from "@/components/quiz/quiz-runner";
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

  // Bugünün vitrin görevi mi: ödül haplarında 2x gösterilecek.
  const isSpotlight = (await getSpotlightTaskId()) === task.id;

  /*
    Takım ilerlemesi definer RPC'den: RLS takım arkadaşlarının teslimlerini
    gizliyor, normal sorgu en fazla kendi teslimini sayardı.
  */
  // Sorular yalnızca quiz görevinde okunuyor; diğer görevlerde bu RPC
  // boş dönerdi ve gereksiz bir tur olurdu.
  const quiz =
    task.verification === "quiz" ? await getTaskQuiz(task.id) : [];

  const teamProgress =
    task.scope === "team" ? await getTeamTaskProgress([task.id]) : null;
  const minTeam = task.min_team_size ?? 2;
  const teamDone = teamProgress?.get(task.id) ?? 0;
  const submission = submissions.get(task.id);

  const participantCount =
    task.capacity !== null ? await getParticipantCount(task.id) : null;

  /*
    Buton yalnızca açık bir teslim yokken görünür. Reddedilen teslim tekrar
    denemeyi engellemiyor; kısıt da (task_submissions_open_unique) yalnızca
    beklemedeki ve onaylanmış satırları kapsıyor.
  */
  /*
    Sürekli görev tekrarlanabilir: bir teslim incelemedeyken bile yenisi
    gönderilebiliyor (D24 FAZ R2 — `task_submissions_open_unique` artık
    continuous'ı dışlıyor). Bu yüzden buton yalnızca diğer tiplerde
    gizleniyor; sürekli görevde açık teslim varsa bilgi satırı gösteriliyor
    ama gönderme yolu açık kalıyor.
  */
  const hasOpenSubmission =
    task.type !== "continuous" &&
    (submission?.status === "pending" || submission?.status === "approved");

  const continuousPending =
    task.type === "continuous" && submission?.status === "pending";

  // Kart ile detayın aynı kuralı kullanması için (D32 FAZ G3).
  const cardState = taskCardState(task.type, submission);

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

      <main className="flex-1 px-4 py-4 has-bottom-nav">
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

        {/*
          Görevi açan kurum + konum (D35 FAZ K).

          Detayda BELİRGİN: kullanıcı görevi yapmadan önce "bunu kim
          istiyor, nerede yapılıyor" sorusunu burada soruyor. Kartta tek
          satıra sıkışan bilgi burada kendi bloğunda.
        */}
        <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-edge bg-card px-3.5 py-3">
          <p className="flex items-center gap-2 text-sm">
            <Icon name="building-2" className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-ink-muted">Görevi açan:</span>
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">
              {taskIssuer(task)}
            </span>
          </p>

          {task.location_label ? (
            <p className="flex items-center gap-2 text-sm">
              <Icon name="map-pin" className="h-4 w-4 shrink-0 text-magenta" />
              <span className="text-ink-muted">Konum:</span>
              <span className="min-w-0 flex-1 font-semibold text-ink">
                {task.location_label}
              </span>
            </p>
          ) : null}
        </div>

        <div className="mt-4">
          <RewardBadges
            xp={task.xp}
            coin={task.coin}
            spotlight={isSpotlight}
          />
        </div>

        {task.scope === "team" ? (
          <div className="mt-4 rounded-2xl border border-magenta/40 bg-magenta/10 p-3.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-magenta">
              <Icon name="users" className="h-4 w-4" />
              Takım görevi
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Takımından en az {minTeam} kişi tamamladığında eşiği sağlayan
              herkese +{task.team_bonus_xp} XP ve +{task.team_bonus_coin} coin
              bonus yazılır.
            </p>

            {/* Üye ilerleme çubuğu: eşiğe ne kadar kaldığı görünsün. */}
            <p className="mt-3 flex items-center justify-between text-[11px] font-semibold text-ink">
              <span>Takımından tamamlayan</span>
              <span className="text-magenta">
                {teamDone} / {minTeam}
              </span>
            </p>
            <span className="mt-1.5 block h-2 w-full overflow-hidden rounded-full bg-surface">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-magenta to-primary transition-all"
                style={{
                  width: `${Math.min(100, Math.round((teamDone / minTeam) * 100))}%`,
                }}
              />
            </span>
            {teamDone >= minTeam ? (
              <p className="mt-2 text-[11px] font-semibold text-status-success">
                Eşik doldu — bonus yazıldı.
              </p>
            ) : null}
          </div>
        ) : null}

        {/*
          Yaklaşan görevde büyük başlangıç geri sayımı; süreli aktif
          görevde bitiş geri sayımı. Tarih satırları ikisinde de yazılı —
          "2 gün" ifadesi tek başına hangi güne denk geldiğini söylemiyor.
        */}
        {task.timeState === "upcoming" && task.starts_at ? (
          <div className="mt-4 rounded-2xl border-2 border-indigo/50 bg-gradient-to-br from-indigo/10 to-primary/10 p-4 text-center">
            <p className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-indigo">
              <Icon name="calendar-clock" className="h-4 w-4" />
              Henüz başlamadı
            </p>
            <p className="mt-1.5 text-2xl font-bold text-ink">
              <Countdown
                endsAt={task.starts_at}
                initialLabel={task.startsInLabel ?? ""}
              />
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {formatDateTime(task.starts_at)}
            </p>

            {/*
              Hatırlatma butonu şimdilik pasif: bildirim altyapısı
              (push/planlanmış bildirim) borçta. Aktifmiş gibi göstermek,
              kullanıcıya tutulmayacak bir söz vermek olurdu.
            */}
            <Button variant="secondary" size="sm" block type="button" disabled>
              Hatırlat (yakında)
            </Button>
          </div>
        ) : task.ends_at ? (
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
            {/*
              Sürekli görevde dünkü onay bugünü kapatmıyor: görev günü
              Europe/Istanbul 06:00'da yenileniyor (M31). Bu satır olmadan
              kart "Tekrar yap" derken detay "Tamamlandı" diyordu ve
              kullanıcı hangisine inanacağını bilmiyordu.
            */}
            {cardState === "repeat" ? (
              <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber">
                <Icon name="flame" className="h-3.5 w-3.5" />
                Yeni gün başladı — bu görevi bugün tekrar yapabilirsin.
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
          {task.starts_at ? (
            <DetailRow label="Başlangıç" value={formatDateTime(task.starts_at)} />
          ) : null}
          {task.ends_at ? (
            <DetailRow label="Bitiş" value={formatDateTime(task.ends_at)} />
          ) : null}
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
            /*
              Yaklaşan görevde teslim butonu pasif. Sunucu zaten
              reddediyor (submit_task başlangıç saatini yazıyor), ama
              tıklanabilir bir buton kullanıcıya "dene" dedirtip hata
              aldırmak demekti.
            */
            task.timeState === "upcoming" ? (
              <Button variant="secondary" size="lg" block type="button" disabled>
                Başlamadı
              </Button>
            ) : hasOpenSubmission ? (
              <p className="rounded-xl border border-edge bg-card px-3.5 py-3 text-center text-sm text-ink-muted">
                {submission?.status === "approved"
                  ? "Bu görevi tamamladın."
                  : "Teslimin incelemeye alındı."}
              </p>
            ) : (
              <>
              {continuousPending ? (
                <p className="mb-3 rounded-xl border border-status-warning/40 bg-status-warning/10 px-3.5 py-2.5 text-center text-xs font-medium text-status-warning">
                  Önceki teslimin incelemede. Bu görevi tekrar
                  gönderebilirsin.
                </p>
              ) : null}
              {task.verification === "quiz" ? (
                <QuizRunner
                  taskId={task.id}
                  questions={quiz}
                  xp={task.xp}
                  coin={task.coin}
                />
              ) : (
                <SubmitTask
                  taskId={task.id}
                  userId={viewer.id}
                  verification={task.verification}
                  xp={task.xp}
                  coin={task.coin}
                />
              )}
              </>
            )
          ) : (
            <Link
              href={`/giris?next=/gorevler/${task.id}`}
              className="block w-full rounded-full btn-chunky bg-cta px-6 py-3 text-center text-base font-semibold text-white"
            >
              Göreve başlamak için giriş yap
            </Link>
          )}
        </div>
      </main>
      <RewardFab />


      <UserBottomNav active="tasks" />
    </div>
  );
}
