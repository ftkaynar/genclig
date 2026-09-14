/*
  Quiz tipleri. Saf veri ayrı dosyada — client bileşenleri import ediyor
  ve `queries.ts` içinde dururken next/headers tarayıcı paketine sızıyor.
*/

export type QuizOption = { key: string; text: string };

export type QuizQuestion = {
  id: string;
  question: string;
  options: QuizOption[];
  sort: number;
};

export type QuizResult = {
  passed: boolean;
  correct_count: number;
  total_count: number;
};

/** Geçme eşiği; sunucudaki `quiz_pass_ratio()` ile aynı değer. */
export const QUIZ_PASS_RATIO = 0.8;
