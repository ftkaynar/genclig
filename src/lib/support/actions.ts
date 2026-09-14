"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { TicketMessage } from "@/lib/support/labels";
import { listTicketMessages } from "@/lib/support/queries";

export type SupportState = { error?: string; notice?: string };

/*
  Destek eylemleri. Doğrulama, yetki ve durum geçişleri RPC'nin içinde;
  buradaki tek iş çağrı ve hata çevirisi.
*/
function translate(message: string): string {
  const known = [
    "Konu en az",
    "Mesaj en az",
    "Mesaj boş",
    "Çok fazla açık talebin",
    "bulunamadı",
    "yetkin yok",
    "kapatılmış",
    "giriş yapmalısın",
  ];
  return known.some((needle) => message.includes(needle))
    ? message
    : "İşlem tamamlanamadı. Lütfen tekrar dene.";
}

function refresh() {
  revalidatePath("/destek");
  revalidatePath("/admin/destek");
}

export async function createTicketAction(
  subject: string,
  body: string,
): Promise<SupportState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_ticket", {
    p_subject: subject.trim(),
    p_body: body.trim(),
  });

  if (error) return { error: translate(error.message) };

  refresh();
  return { notice: "Talebin oluşturuldu." };
}

export async function replyTicketAction(
  ticketId: string,
  body: string,
): Promise<SupportState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reply_ticket", {
    p_ticket: ticketId,
    p_body: body.trim(),
  });

  if (error) return { error: translate(error.message) };

  refresh();
  return { notice: "Mesajın gönderildi." };
}

export async function closeTicketAction(
  ticketId: string,
): Promise<SupportState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_ticket", { p_ticket: ticketId });

  if (error) return { error: translate(error.message) };

  refresh();
  return { notice: "Talep kapatıldı." };
}

/**
 * Konuşma geçmişi. Client bileşeni talebi açtığında çağırıyor; bütün
 * talepleri baştan çekmek, çoğu hiç açılmayacakken gereksiz veri demekti.
 */
export async function getTicketMessagesAction(
  ticketId: string,
): Promise<TicketMessage[]> {
  return listTicketMessages(ticketId);
}
