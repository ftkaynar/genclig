"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type SocialState = { error?: string; notice?: string };

/*
  Arkadaşlık eylemleri. Kurallar (kendine istek, mevcut ilişki, yetki) RPC'nin
  içinde; buradaki tek iş çağrı ve hata çevirisi.
*/

function translate(message: string): string {
  const known = [
    "bulunamadı",
    "Kendine",
    "Zaten arkadaş",
    "Bekleyen bir istek",
    "gönderilemiyor",
    "yanıtlanmış",
    "yetkin yok",
    "giriş yapmalısın",
  ];
  return known.some((needle) => message.includes(needle))
    ? message
    : "İşlem tamamlanamadı. Lütfen tekrar dene.";
}

export async function sendFriendRequestAction(
  username: string,
): Promise<SocialState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_friend_request", {
    p_username: username.trim(),
  });

  if (error) return { error: translate(error.message) };

  revalidatePath("/arkadaslar");
  return { notice: "İstek gönderildi." };
}

export async function respondFriendRequestAction(
  id: string,
  accept: boolean,
): Promise<SocialState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_friend_request", {
    p_id: id,
    p_accept: accept,
  });

  if (error) return { error: translate(error.message) };

  revalidatePath("/arkadaslar");
  revalidatePath("/siralama");
  return { notice: accept ? "Arkadaş eklendi." : "İstek reddedildi." };
}

export async function removeFriendAction(userId: string): Promise<SocialState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_friend", { p_user_id: userId });

  if (error) return { error: translate(error.message) };

  revalidatePath("/arkadaslar");
  revalidatePath("/siralama");
  return { notice: "Arkadaşlıktan çıkarıldı." };
}

export type SearchResult = {
  username: string;
  avatar_url: string | null;
  level: number;
  user_id: string;
};

export async function searchUsersAction(query: string): Promise<SearchResult[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("search_users", { p_q: query });
  return (data ?? []) as SearchResult[];
}

export type ProfileCard = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  is_friend: boolean;
  request_status: string;
  total_xp: number | null;
  badge_count: number | null;
  completed_tasks: number | null;
  /*
    İstatlar yalnızca arkadaşlarda dolu geliyor; arkadaş değilken hepsi
    null. Karar sunucuda (get_profile_card) — istemcide gizlemek, veriyi
    zaten göndermiş olmak demekti.
  */
  akt: number | null;
  sos: number | null;
  kat: number | null;
  kes: number | null;
  bil: number | null;
  azm: number | null;
  ovr: number | null;
  tier: string | null;
};

export async function getProfileCardAction(
  username: string,
): Promise<ProfileCard | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_profile_card", {
    p_username: username,
  });
  const rows = (data ?? []) as ProfileCard[];
  return rows[0] ?? null;
}
