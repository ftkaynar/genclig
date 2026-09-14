"use server";

import { revalidatePath } from "next/cache";

import type { QuizResult } from "@/lib/quiz/labels";
import { createClient } from "@/lib/supabase/server";

export type QuizState = { error?: string; result?: QuizResult };

/*
  Cevap kontrolü tamamen sunucuda: doğru anahtarlar hiçbir zaman istemciye
  gitmiyor, `submit_quiz` karşılaştırmayı veritabanında yapıyor ve yalnızca
  sonucu döndürüyor. Puan yazımı da orada (award_task_points).
*/
function translate(message: string): string {
  const known = [
    "Görev bulunamadı",
    "Görev aktif değil",
    "test görevi değil",
    "henüz başlamadı",
    "süresi dolmuş",
    "takım görevi",
    "zaten tamamladın",
    "soruları henüz hazır değil",
    "giriş yapmalısın",
  ];
  return known.some((needle) => message.includes(needle))
    ? message
    : "İşlem tamamlanamadı. Lütfen tekrar dene.";
}

export async function submitQuizAction(
  taskId: string,
  answers: Record<string, string>,
): Promise<QuizState> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("submit_quiz", {
    p_task_id: taskId,
    p_answers: answers,
  });

  if (error) return { error: translate(error.message) };

  const rows = (data ?? []) as QuizResult[];
  const result = rows[0];

  if (!result) return { error: "Sonuç alınamadı. Lütfen tekrar dene." };

  if (result.passed) {
    revalidatePath("/gorevler");
    revalidatePath(`/gorevler/${taskId}`);
    revalidatePath("/");
  }

  return { result };
}
