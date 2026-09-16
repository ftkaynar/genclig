import type {
  ChannelMessage,
  ModerationRow,
  MyChannel,
} from "@/lib/community/labels";
import { createClient } from "@/lib/supabase/server";

/*
  Topluluk okumaları security definer RPC'lerden geliyor: mesajın yanında
  kullanıcı adı, avatar ve seviye gösteriliyor ve üçü de profiles üzerinde,
  RLS orada kullanıcıya yalnızca kendi satırını gösteriyor. Fonksiyonlar
  yalnızca çağıranın kendi kanalını (moderatörse yetkili olduğu kanalı)
  döndürüyor.
*/

export async function getMyChannel(): Promise<MyChannel | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_channel");
  const rows = (data ?? []) as MyChannel[];
  return rows[0] ?? null;
}

export async function listChannelMessages(
  limit = 100,
): Promise<ChannelMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_channel_messages", {
    p_limit: limit,
  });
  return (data ?? []) as ChannelMessage[];
}

export async function listModerationQueue(): Promise<ModerationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_moderation_queue");
  return (data ?? []) as ModerationRow[];
}

/* ---------------------------------------------------------------------------
   İl kanal gezgini (D32 FAZ KE)

   Kullanıcı artık yalnız kendi ilinin değil, istediği ilin kanalını
   okuyabiliyor ve oraya yazabiliyor. Gençleri kendi illerine hapsetmek
   platformun amacına aykırıydı.

   Güvenlik kuralları AYNEN her kanalda geçerli: oran sınırı (kullanıcı
   bazlı, il değiştirerek aşılamıyor), susturma, raporlama, 18-altı
   uyarısı.
   --------------------------------------------------------------------------- */

export type ProvinceChannel = {
  channel_id: string;
  province_id: number;
  province_name: string;
};

/** Seçici listesi: 81 il kanalı. */
export async function listProvinceChannels(): Promise<ProvinceChannel[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("channels")
    .select("id,province_id,provinces(name)")
    .eq("scope", "province");

  const rows = (data ?? []) as unknown as {
    id: string;
    province_id: number;
    provinces: { name: string } | null;
  }[];

  /*
    Sıralama SQL'de değil burada: Postgres'in varsayılan harmanlaması
    Türkçe değil ve 'İzmir' ile 'Istanbul' yanlış yere düşüyordu.
    localeCompare('tr') doğru sırayı veriyor; 81 satır için maliyeti yok.
  */
  return rows
    .filter((row) => row.provinces)
    .map((row) => ({
      channel_id: row.id,
      province_id: row.province_id,
      province_name: row.provinces!.name,
    }))
    .sort((a, b) => a.province_name.localeCompare(b.province_name, "tr"));
}

/** Seçilen kanalın başlığı ve susturma durumu. */
export async function getChannelInfo(
  channelId: string,
): Promise<MyChannel | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("channel_info", {
    p_channel: channelId,
  });
  const rows = (data ?? []) as {
    channel_id: string;
    name: string;
    province_name: string;
    muted_until: string | null;
  }[];
  const row = rows[0];
  if (!row) return null;

  /*
    MyChannel tipindeki `district_name` alanı İL adı taşıyor. Alan adı
    my_channel RPC'sinin OUT parametresinden geliyor ve değiştirmek
    dönüş tipini değiştirir (`create or replace` bunu yapamıyor —
    M26'da ölçüldü).
  */
  return {
    channel_id: row.channel_id,
    name: row.name,
    district_name: row.province_name,
    muted_until: row.muted_until,
  };
}

/** Seçilen kanalın mesajları. */
export async function listChannelMessagesOf(
  channelId: string,
  limit = 100,
): Promise<ChannelMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_channel_messages_of", {
    p_channel: channelId,
    p_limit: limit,
  });
  return (data ?? []) as ChannelMessage[];
}
