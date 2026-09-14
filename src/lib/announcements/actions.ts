"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type AnnouncementState = { error?: string; notice?: string };

/*
  Duyuru gönderimi. Yetki kuralı (süper admin her hedef, personel yalnızca
  kendi belediyesi) RPC'nin içinde; buradaki tek iş çağrı ve hata çevirisi.
*/
function translate(message: string): string {
  const known = [
    "Başlık en az",
    "Duyuru metni en az",
    "Geçersiz hedef",
    "kendi belediyenin",
    "duyuru gönderme yetkin yok",
    "Belediye seçilmedi",
    "Kullanıcı bulunamadı",
    "giriş yapmalısın",
  ];
  return known.some((needle) => message.includes(needle))
    ? message
    : "İşlem tamamlanamadı. Lütfen tekrar dene.";
}

export async function sendAnnouncementAction(input: {
  title: string;
  body: string;
  audience: string;
  municipalityId?: string | null;
  username?: string | null;
}): Promise<AnnouncementState> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("send_announcement", {
    p_title: input.title.trim(),
    p_body: input.body.trim(),
    p_audience: input.audience,
    p_municipality: input.municipalityId || null,
    p_username: input.username?.trim() || null,
  });

  if (error) return { error: translate(error.message) };

  revalidatePath("/admin/duyurular");
  revalidatePath("/panel/duyurular");

  const count = typeof data === "number" ? data : 0;
  return { notice: `Duyuru ${count} kişiye gönderildi.` };
}
