/*
  Topluluk tipleri.

  Saf veri ayrı dosyada: client bileşenleri bunları import ediyor ve
  `queries.ts` içinde dururken next/headers'a bağımlı `createClient`
  tarayıcı paketine sızıyor (D21 destek ve D22 duyuru fazlarında ölçüldü).
*/

export type ChannelMessage = {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  body: string;
  is_deleted: boolean;
  created_at: string;
  is_mine: boolean;
};

export type MyChannel = {
  channel_id: string;
  name: string;
  /**
   * İL adı.
   *
   * Alan adı `district_name` kaldı çünkü `my_channel` RPC'sinin OUT
   * parametre adını değiştirmek dönüş tipini değiştirir ve
   * `create or replace` bunu yapamıyor (M26'da ölçüldü). D29'da
   * topluluk ilçeden İL'e taşındı; bu alan artık il adı taşıyor.
   */
  district_name: string;
  muted_until: string | null;
};

export type ModerationRow = {
  message_id: string;
  channel_id: string;
  channel_name: string;
  author_id: string;
  author_username: string;
  body: string;
  is_deleted: boolean;
  report_count: number;
  reasons: string | null;
  created_at: string;
};

/** Mesaj kutusunun üst sınırı; sunucu da aynı değeri uyguluyor. */
export const MESSAGE_MAX = 500;

/** Susturma süresi seçenekleri (dakika). */
export const MUTE_OPTIONS = [
  { minutes: 60, label: "1 saat" },
  { minutes: 60 * 24, label: "1 gün" },
  { minutes: 60 * 24 * 7, label: "1 hafta" },
] as const;
