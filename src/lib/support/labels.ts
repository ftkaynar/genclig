/*
  Destek tipleri ve etiketleri.

  Neden ayrı dosya: bu değerler hem sunucu sorgularında hem client
  bileşenlerinde gerekiyor. queries.ts içinde dururken client import'u
  next/headers'a bağımlı createClient'ı da bundle'a çekiyordu ve derleme
  "This API is only available in Server Components" hatasıyla kırılıyordu
  (ölçüldü). Saf veri burada, veri erişimi queries.ts'te.
*/

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type TicketStatus = "open" | "answered" | "closed";

export type TicketRow = {
  id: string;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
};

export type TicketMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  body: string;
  is_staff: boolean;
  created_at: string;
};

export type AdminTicketRow = {
  id: string;
  subject: string;
  status: TicketStatus;
  username: string;
  message_count: number;
  updated_at: string;
};

export const TICKET_STATUS_LABEL: Record<string, string> = {
  open: "Yanıt bekliyor",
  answered: "Yanıtlandı",
  closed: "Kapatıldı",
};
