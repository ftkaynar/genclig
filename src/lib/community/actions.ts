"use server";

import { revalidatePath } from "next/cache";

import type { ChannelMessage } from "@/lib/community/labels";
import { listChannelMessages } from "@/lib/community/queries";
import { createClient } from "@/lib/supabase/server";

export type CommunityState = { error?: string; notice?: string };

/*
  Topluluk eylemleri. Hız sınırı, susturma kontrolü, kanal çözümü ve
  moderasyon yetkisi RPC'lerin içinde; buradaki tek iş çağrı ve hata
  çevirisi.

  Beyaz liste: ham Postgres hataları kullanıcıya gösterilmemeli; yalnızca
  bilerek yazdığımız Türkçe mesajlar geçiyor.
*/
function translate(message: string): string {
  const known = [
    "Önce ilçeni ayarla",
    "Mesaj boş olamaz",
    "en fazla 500 karakter",
    "geçici olarak yazamıyorsun",
    "Biraz yavaş",
    "Çok fazla mesaj",
    "Mesaj bulunamadı",
    "Kendi mesajını",
    "raporlama yetkin yok",
    "moderasyon yetkin yok",
    "Global susturma",
    "Kendini susturamazsın",
    "Susturma süresi",
    "giriş yapmalısın",
  ];
  return known.some((needle) => message.includes(needle))
    ? message
    : "İşlem tamamlanamadı. Lütfen tekrar dene.";
}

export async function postMessageAction(
  body: string,
): Promise<CommunityState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_message", { p_body: body });

  if (error) return { error: translate(error.message) };

  revalidatePath("/topluluk");
  return {};
}

export async function deleteOwnMessageAction(
  id: string,
): Promise<CommunityState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_own_message", { p_id: id });

  if (error) return { error: translate(error.message) };

  revalidatePath("/topluluk");
  return { notice: "Mesajın silindi." };
}

export async function reportMessageAction(
  id: string,
  reason: string,
): Promise<CommunityState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_message", {
    p_id: id,
    p_reason: reason,
  });

  if (error) return { error: translate(error.message) };

  revalidatePath("/topluluk");
  return { notice: "Bildirimin alındı, teşekkürler." };
}

/**
 * Sohbeti yeniden okur.
 *
 * Client bileşeni 30 saniyede bir çağırıyor. Gerçek zamanlı kanal yerine
 * yoklama: Supabase realtime bu dilimin DOKUNMA listesinde ve sohbet
 * hacmi bu ölçekte yoklamayla rahat taşınıyor.
 */
export async function refreshMessagesAction(): Promise<ChannelMessage[]> {
  return listChannelMessages(100);
}

// --------------------------------------------------------------- moderasyon

function refreshModeration() {
  revalidatePath("/panel/moderasyon");
  revalidatePath("/admin/moderasyon");
  revalidatePath("/topluluk");
}

export async function moderateDeleteAction(
  id: string,
): Promise<CommunityState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_delete", { p_id: id });

  if (error) return { error: translate(error.message) };

  refreshModeration();
  return { notice: "Mesaj kaldırıldı." };
}

export async function moderateRestoreAction(
  id: string,
): Promise<CommunityState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_restore", { p_id: id });

  if (error) return { error: translate(error.message) };

  refreshModeration();
  return { notice: "Mesaj geri açıldı." };
}

export async function resolveReportAction(
  messageId: string,
): Promise<CommunityState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_report", {
    p_message: messageId,
  });

  if (error) return { error: translate(error.message) };

  refreshModeration();
  return { notice: "Rapor kapatıldı." };
}

export async function muteUserAction(input: {
  userId: string;
  channelId: string | null;
  minutes: number;
  reason: string;
}): Promise<CommunityState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mute_user", {
    p_user: input.userId,
    p_channel: input.channelId,
    p_minutes: input.minutes,
    p_reason: input.reason || null,
  });

  if (error) return { error: translate(error.message) };

  refreshModeration();
  return { notice: "Kullanıcı susturuldu." };
}
