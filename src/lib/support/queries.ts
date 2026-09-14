import { createClient } from "@/lib/supabase/server";
import type {
  AdminTicketRow,
  FaqItem,
  TicketMessage,
  TicketRow,
} from "@/lib/support/labels";

/*
  SSS ve talepler doğrudan tablodan okunuyor; yazma yolları RPC'de.
  RLS kullanıcıya yalnızca kendi taleplerini, süper admine hepsini gösteriyor,
  bu yüzden okuma için ayrıca definer fonksiyona gerek yok. Tek istisna
  personel kuyruğu: kullanıcı adını ve mesaj sayısını tek sorguda toplamak
  RLS altında mümkün değildi.
*/

export async function listFaq(): Promise<FaqItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("faq_items")
    .select("id,question,answer")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as FaqItem[];
}

export async function listMyTickets(): Promise<TicketRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("support_tickets")
    .select("id,subject,status,created_at,updated_at")
    .order("updated_at", { ascending: false });
  return (data ?? []) as TicketRow[];
}

export async function listTicketMessages(
  ticketId: string,
): Promise<TicketMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ticket_messages")
    .select("id,ticket_id,sender_id,body,is_staff,created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  return (data ?? []) as TicketMessage[];
}

export async function listAllTickets(
  status?: string,
): Promise<AdminTicketRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_all_tickets", {
    p_status: status ?? null,
  });
  return (data ?? []) as AdminTicketRow[];
}
