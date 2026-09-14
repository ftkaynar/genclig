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
