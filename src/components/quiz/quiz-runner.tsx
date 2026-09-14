"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Celebration } from "@/components/game/celebration";
import { Icon } from "@/components/ui/icon";
import { submitQuizAction } from "@/lib/quiz/actions";
import type { QuizQuestion, QuizResult } from "@/lib/quiz/labels";

/*
  Test çözme akışı.

  Soru soru ilerliyor: hepsini tek ekranda göstermek mobilde uzun bir
  kaydırma ve "nerede kaldım" belirsizliği demekti. Üstte ilerleme
  çubuğu, altta sonuç ekranı.

  Doğru cevaplar burada YOK. Kontrol tamamen `submit_quiz` içinde;
  istemciye yalnızca kaç doğru yapıldığı dönüyor.
*/
export function QuizRunner({
  taskId,
  questions,
  xp,
  coin,
}: {
  taskId: string;
  questions: QuizQuestion[];
  xp: number;
  coin: number;
}) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);

  if (questions.length === 0) {
    return (
      <p className="mt-4 rounded-2xl border border-edge bg-card px-4 py-6 text-center text-sm text-ink-muted">
        Bu görevin soruları henüz hazır değil.
      </p>
    );
  }

  // ------------------------------------------------------------ sonuç ekranı
  if (result) {
    const wrong = result.total_count - result.correct_count;

    return (
      <div className="mt-4">
        {result.passed ? (
          <Celebration
            data={{ xp, coin, approved: true }}
            onClose={() => router.refresh()}
          />
        ) : null}

        <div
          className={`rounded-2xl border-2 p-5 text-center ${
            result.passed
              ? "border-status-success/60 bg-status-success/10"
              : "border-status-warning/60 bg-status-warning/10"
          }`}
        >
          <Icon
            name={result.passed ? "check" : "timer"}
            className={`mx-auto h-8 w-8 ${
              result.passed ? "text-status-success" : "text-status-warning"
            }`}
          />

          <p className="mt-2 text-base font-bold text-ink">
            {result.passed ? "Testi geçtin!" : "Bu sefer olmadı"}
          </p>

          <p className="mt-1 text-sm text-ink-muted">
            {result.correct_count} doğru · {wrong} yanlış ·{" "}
            {Math.round((result.correct_count / result.total_count) * 100)}%
          </p>

          {result.passed ? (
            <p className="mt-2 text-sm font-semibold text-status-success">
              +{xp} XP • +{coin} Token hesabına yazıldı.
            </p>
          ) : (
            <p className="mt-2 text-xs text-ink-muted">
              Geçmek için soruların en az %80&apos;ini doğru yanıtlaman
              gerekiyor. Tekrar deneyebilirsin.
            </p>
          )}

          <div className="mt-4 flex gap-2">
            {result.passed ? (
              <Link
                href="/gorevler"
                className="btn-chunky bg-cta flex-1 rounded-full px-4 py-2.5 text-sm font-semibold text-white"
              >
                Görevlere dön
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setAnswers({});
                  setIndex(0);
                  setStarted(true);
                }}
                className="btn-chunky bg-cta flex-1 rounded-full px-4 py-2.5 text-sm font-semibold text-white"
              >
                Tekrar dene
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ başlangıç
  if (!started) {
    return (
      <button
        type="button"
        onClick={() => setStarted(true)}
        className="btn-chunky bg-cta mt-4 w-full rounded-full px-4 py-3 text-sm font-bold uppercase tracking-wide text-white"
      >
        Testi çöz · {questions.length} soru
      </button>
    );
  }

  // ------------------------------------------------------------ soru ekranı
  const current = questions[index];
  const selected = answers[current.id];
  const isLast = index === questions.length - 1;
  const answeredAll = questions.every((item) => answers[item.id]);

  async function finish() {
    setError(null);
    setPending(true);
    try {
      const state = await submitQuizAction(taskId, answers);
      if (state.error) {
        setError(state.error);
        return;
      }
      setResult(state.result ?? null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      {/* İlerleme */}
      <div className="flex items-center justify-between text-[11px] font-medium text-ink-muted">
        <span>
          Soru {index + 1} / {questions.length}
        </span>
        <span>{Object.keys(answers).length} yanıtlandı</span>
      </div>
      <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-edge">
        <span
          className="brand-gradient block h-full rounded-full transition-all"
          style={{
            width: `${((index + 1) / questions.length) * 100}%`,
          }}
        />
      </span>

      <div className="mt-4 rounded-2xl border border-edge bg-card p-4">
        <p className="text-sm font-semibold text-ink">{current.question}</p>

        <ul className="mt-3 flex flex-col gap-2">
          {current.options.map((option) => {
            const isPicked = selected === option.key;
            return (
              <li key={option.key}>
                <button
                  type="button"
                  onClick={() =>
                    setAnswers({ ...answers, [current.id]: option.key })
                  }
                  aria-pressed={isPicked}
                  className={`flex w-full items-center gap-2.5 rounded-xl border-2 px-3.5 py-3 text-left text-sm transition-colors ${
                    isPicked
                      ? "border-primary bg-primary/10 font-semibold text-ink"
                      : "border-edge bg-surface text-ink-muted hover:text-ink"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      isPicked ? "border-primary" : "border-edge"
                    }`}
                  >
                    {isPicked ? (
                      <span className="block h-2.5 w-2.5 rounded-full bg-primary" />
                    ) : null}
                  </span>
                  {option.text}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-status-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        {index > 0 ? (
          <button
            type="button"
            onClick={() => setIndex(index - 1)}
            className="rounded-full border border-edge px-4 py-2.5 text-sm font-medium text-ink-muted"
          >
            Geri
          </button>
        ) : null}

        {isLast ? (
          <button
            type="button"
            disabled={pending || !answeredAll}
            onClick={finish}
            className="btn-chunky bg-cta flex-1 rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {pending
              ? "Kontrol ediliyor..."
              : answeredAll
                ? "Testi bitir"
                : "Tüm soruları yanıtla"}
          </button>
        ) : (
          <button
            type="button"
            disabled={!selected}
            onClick={() => setIndex(index + 1)}
            className="btn-chunky bg-cta flex-1 rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            Sonraki soru
          </button>
        )}
      </div>
    </div>
  );
}
