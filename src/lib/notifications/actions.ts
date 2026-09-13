"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/*
  Okundu işaretleme rpc üzerinden.
  Tabloda UPDATE politikası yok: politika hangi sütunun değiştiğini göremiyor,
  kullanıcı kendi bildiriminin başlığını da düzenleyebilirdi. Fonksiyon
  yalnızca is_read alanına dokunuyor ve yalnızca çağıranın satırında.
*/

export async function markNotificationReadAction(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_notification_read", { p_id: id });
  revalidatePath("/bildirimler");
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_all_notifications_read");
  revalidatePath("/bildirimler");
  revalidatePath("/", "layout");
}
