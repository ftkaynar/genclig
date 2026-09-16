import { createClient } from "@/lib/supabase/server";
import {
  isKnownMissing,
  isMissingSchema,
  markMissing,
} from "@/lib/supabase/schema-guard";

/*
  Davet sistemi (D33 FAZ DV).

  Ödülü veritabanı yazıyor (check_referral_reward); buradaki iş yalnız
  kodu ve ayarları okumak.

  Ödül miktarları TABLODAN geliyor, koda gömülü değil: yönetici
  değiştirince karttaki metin de değişmeli. "+100 Token" yazan sabit
  bir metin, ayar 50'ye indiğinde yalan söylüyordu.

  Şema geride kalırsa null dönüyor ve davet kartı hiç çizilmiyor —
  D32'de ölçtüğümüz kesintiyi tekrarlamamak için.
*/

const INVITE_RPC = "my_invite";

export type MyInvite = {
  invite_code: string | null;
  invited_count: number;
  rewarded_count: number;
  inviter_xp: number;
  inviter_token: number;
  invited_xp: number;
  invited_token: number;
  active: boolean;
};

export async function getMyInvite(): Promise<MyInvite | null> {
  if (isKnownMissing(INVITE_RPC)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_invite");

  if (error) {
    if (isMissingSchema(error)) markMissing(INVITE_RPC);
    return null;
  }

  const rows = (data ?? []) as MyInvite[];
  const row = rows[0];

  // Kodu olmayan profil (trigger öncesi bir satır kalmışsa) kart göstermiyor.
  return row?.invite_code ? row : null;
}

/**
 * Paylaşım bağlantısı.
 *
 * Alan adı ortam değişkeninden: yerelde ve önizlemede farklı adres var
 * ve kullanıcıya localhost bağlantısı vermek işe yaramıyor. Değişken
 * yoksa üretim adresine düşüyor — kullanıcı paylaşacağı bağlantıyı
 * her durumda görmeli.
 */
export function inviteLink(code: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://genclig.vercel.app";
  return `${base}/kayit?davet=${code}`;
}
