/*
  Duyuru tipleri ve etiketleri.

  Neden ayrı dosya: bu değerler hem sunucu sorgularında hem client
  bileşenlerinde gerekiyor. `queries.ts` içinde dururken client import'u
  next/headers'a bağımlı `createClient`'ı da bundle'a çekiyor ve derleme
  "This API is only available in Server Components" ile kırılıyor —
  aynı tuzağa D21 destek fazında düşülmüştü.
*/

export type Audience = "all" | "municipality" | "user";

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  municipality_name: string | null;
  sent_count: number;
  created_by_username: string | null;
  created_at: string;
};

export type LatestAnnouncement = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
};

export const AUDIENCE_LABEL: Record<string, string> = {
  all: "Tüm kullanıcılar",
  municipality: "Belediye",
  user: "Tek kullanıcı",
};
