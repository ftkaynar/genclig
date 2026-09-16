"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

import { Icon } from "@/components/ui/icon";

export type EditorOption = { key: string; text: string };

export type EditorQuestion = {
  id?: string;
  question: string;
  options: EditorOption[];
  correctKey: string;
};

/** Şık anahtarları sabit harf dizisi; editörde ekle/sil sırayı bozmasın. */
const KEYS = ["a", "b", "c", "d", "e", "f"];

export const EMPTY_QUESTION: EditorQuestion = {
  question: "",
  options: [
    { key: "a", text: "" },
    { key: "b", text: "" },
  ],
  correctKey: "a",
};

/*
  Quiz soru editörü.

  Yalnızca `verification = "quiz"` seçiliyken görünüyor. Doğru şık burada
  işaretleniyor ve kaydetme sırasında sunucuya gidiyor; kullanıcı tarafına
  hiçbir zaman dönmüyor (get_task_quiz correct_key içermiyor).

  Şık sayısı 2–6 arasında sınırlı; veritabanında da aynı kısıt var
  (`task_quiz_options_count`). İki yerde birden olması bilinçli: form
  atlanabilir, kısıt atlanamaz.
*/
export function QuizEditor({
  questions,
  onChange,
}: {
  questions: EditorQuestion[];
  onChange: (next: EditorQuestion[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  function update(index: number, patch: Partial<EditorQuestion>) {
    onChange(
      questions.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function addQuestion() {
    onChange([...questions, { ...EMPTY_QUESTION, options: [
      { key: "a", text: "" },
      { key: "b", text: "" },
    ] }]);
  }

  function removeQuestion(index: number) {
    onChange(questions.filter((_, i) => i !== index));
  }

  function addOption(index: number) {
    const question = questions[index];
    if (question.options.length >= 6) {
      setError("Bir soruda en fazla 6 şık olabilir.");
      return;
    }
    setError(null);
    update(index, {
      options: [
        ...question.options,
        { key: KEYS[question.options.length], text: "" },
      ],
    });
  }

  function removeOption(index: number, optionKey: string) {
    const question = questions[index];
    if (question.options.length <= 2) {
      setError("Bir soruda en az 2 şık olmalı.");
      return;
    }
    setError(null);

    // Şık silinince anahtarlar yeniden harflenir; aksi halde "a, c" gibi
    // boşluklu bir dizi kalıyordu ve doğru şık işareti kayabiliyordu.
    const kept = question.options.filter((item) => item.key !== optionKey);
    const relabeled = kept.map((item, i) => ({ ...item, key: KEYS[i] }));
    const removedIndex = question.options.findIndex(
      (item) => item.key === optionKey,
    );
    const oldCorrectIndex = question.options.findIndex(
      (item) => item.key === question.correctKey,
    );

    let correctIndex = oldCorrectIndex;
    if (oldCorrectIndex === removedIndex) correctIndex = 0;
    else if (oldCorrectIndex > removedIndex) correctIndex = oldCorrectIndex - 1;

    update(index, {
      options: relabeled,
      correctKey: relabeled[correctIndex]?.key ?? "a",
    });
  }

  return (
    <div className="rounded-2xl border border-edge bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Test soruları</h3>
        <span className="text-[11px] text-ink-muted">
          {questions.length} soru
        </span>
      </div>

      <p className="mt-1 text-[11px] text-ink-muted">
        Kullanıcı soruların en az %80&apos;ini doğru yanıtlayınca görev
        otomatik onaylanır. Doğru şık kullanıcıya hiçbir zaman gönderilmez.
      </p>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-status-danger">
          {error}
        </p>
      ) : null}

      <ul className="mt-3 flex flex-col gap-3">
        {questions.map((question, index) => (
          <li
            key={index}
            className="rounded-xl border border-edge bg-card p-3.5"
          >
            <div className="flex items-start gap-2">
              <span className="mt-2 text-[11px] font-bold text-ink-muted">
                {index + 1}.
              </span>
              <input
                value={question.question}
                onChange={(event) =>
                  update(index, { question: event.target.value })
                }
                placeholder="Soru metni"
                maxLength={500}
                className="flex-1 rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary"
              />
              <button
                type="button"
                onClick={() => removeQuestion(index)}
                aria-label="Soruyu sil"
                className="mt-1 shrink-0 rounded-full p-1 text-status-danger"
              >
                <Icon name="trash-2" className="h-4 w-4" />
              </button>
            </div>

            <ul className="mt-2.5 flex flex-col gap-1.5">
              {question.options.map((option) => (
                <li key={option.key} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => update(index, { correctKey: option.key })}
                    aria-label={`${option.key} şıkkını doğru işaretle`}
                    aria-pressed={question.correctKey === option.key}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                      question.correctKey === option.key
                        ? "border-status-success bg-status-success text-white"
                        : "border-edge text-ink-muted"
                    }`}
                  >
                    {question.correctKey === option.key ? (
                      <Icon name="check" className="h-3 w-3" />
                    ) : (
                      <span className="text-[10px] font-bold uppercase">
                        {option.key}
                      </span>
                    )}
                  </button>

                  <input
                    value={option.text}
                    onChange={(event) =>
                      update(index, {
                        options: question.options.map((item) =>
                          item.key === option.key
                            ? { ...item, text: event.target.value }
                            : item,
                        ),
                      })
                    }
                    placeholder={`${option.key.toUpperCase()} şıkkı`}
                    maxLength={200}
                    className="flex-1 rounded-lg border border-edge bg-surface px-3 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary"
                  />

                  <button
                    type="button"
                    onClick={() => removeOption(index, option.key)}
                    aria-label="Şıkkı sil"
                    className="shrink-0 rounded-full p-1 text-ink-muted"
                  >
                    <Icon name="x" className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>

            <Button variant="secondary" size="sm" type="button" onClick={() => addOption(index)}>
              Şık ekle
            </Button>
          </li>
        ))}
      </ul>

      <Button variant="primary" size="sm" type="button" onClick={addQuestion}>
        Soru ekle
      </Button>
    </div>
  );
}
