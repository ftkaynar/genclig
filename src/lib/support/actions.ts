"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push/send";
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("user_id,subject")
    .eq("id", ticketId)
    .maybeSingle();

  const { error } = await supabase.rpc("reply_ticket", {
    p_ticket: ticketId,
    p_body: body.trim(),
  });

  if (error) return { error: translate(error.message) };

  /*
    Push yalnızca KARŞI TARAFA — kendi yanıtına kendine bildirim
    gitmemeli. Aynı kural reply_ticket içinde de var (M29a); burada
    tekrar bakılmasının sebebi push'un ayrı bir yol olması: DB
    bildirimi düşmediği hâlde push gitseydi sayaç ile bildirim
    birbirini tutmazdı.
  */
  if (ticket?.user_id && user?.id && ticket.user_id !== user.id) {
    await sendPushToUser(ticket.user_id, {
      title: "Destek talebine yanıt geldi",
      body: ticket.subject ?? "",
      url: `/destek?talep=${ticketId}`,
      tag: "support",
    });
  }

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
