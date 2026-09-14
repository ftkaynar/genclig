import type { QuizQuestion } from "@/lib/quiz/labels";
import { createClient } from "@/lib/supabase/server";

/*
  Sorular security definer RPC'den geliyor ve doğru cevap anahtarını
  İÇERMİYOR. Ham `task_quiz_questions` tablosunda kullanıcı için select
  politikası yok; anahtarı yalnızca soruyu yazan personel görebiliyor.
*/
export async function getTaskQuiz(taskId: string): Promise<QuizQuestion[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_task_quiz", {
    p_task_id: taskId,
  });
  return (data ?? []) as QuizQuestion[];
}
