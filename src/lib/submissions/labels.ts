/*
  Teslim takibi tipleri. Saf veri ayrı dosyada — client bileşenleri
  import ediyor ve `queries.ts` içinde dururken next/headers tarayıcı
  paketine sızıyor.
*/

export type MySubmission = {
  id: string;
  task_id: string;
  task_title: string;
  task_icon: string | null;
  xp: number;
  coin: number;
  status: "pending" | "approved" | "rejected";
  photo_path: string | null;
  reject_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export const SUBMISSION_TABS = [
  { key: "pending", label: "İncelemede", tone: "text-status-warning bg-status-warning/15" },
  { key: "approved", label: "Onaylanan", tone: "text-status-success bg-status-success/15" },
  { key: "rejected", label: "Reddedilen", tone: "text-status-danger bg-status-danger/15" },
] as const;

export type SubmissionTab = (typeof SUBMISSION_TABS)[number]["key"];
