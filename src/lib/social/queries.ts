import { createClient } from "@/lib/supabase/server";

export type FriendRow = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  weekly_xp: number;
};

export type FriendRequestRow = {
  id: string;
  direction: "incoming" | "outgoing";
  username: string;
  avatar_url: string | null;
  created_at: string;
};

/*
  Arkadaş verileri security definer fonksiyonlardan geliyor.
  friendships tablosu RLS ile kullanıcının taraf olduğu satırlarla sınırlı;
  arkadaşın profilini okumak için ayrıca profiles'a erişim gerekiyor ve o
  tabloda kullanıcı yalnızca kendi satırını görüyor.
*/

export async function listFriends(): Promise<FriendRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_friends");
  return (data ?? []) as FriendRow[];
}

export async function listFriendRequests(): Promise<FriendRequestRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_friend_requests");
  return (data ?? []) as FriendRequestRow[];
}
