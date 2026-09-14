"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type TeamState = { error?: string; notice?: string };

/*
  Takım eylemleri. Kurallar (tek takım, kaptan yetkisi, kontenjan) RPC'nin
  içinde; buradaki tek iş çağrı ve hata çevirisi.

  Beyaz liste: RPC'den gelen ham Postgres hataları (kısıt adı, tablo adı)
  kullanıcıya gösterilmemeli; yalnızca bilerek yazdığımız Türkçe mesajlar
  geçiyor.
*/
function translate(message: string): string {
  const known = [
    "Zaten bir takımdasın",
    "Takım adı",
    "bulunamadı",
    "Takım dolu",
    "Bir takımda değilsin",
    "kaptanlığı",
    "kaptanı olmalısın",
    "Kendini çıkaramazsın",
    "takımında değil",
    "giriş yapmalısın",
  ];
  return known.some((needle) => message.includes(needle))
    ? message
    : "İşlem tamamlanamadı. Lütfen tekrar dene.";
}

function refresh() {
  revalidatePath("/takim");
  revalidatePath("/siralama");
}

export async function createTeamAction(
  name: string,
  icon: string,
): Promise<TeamState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_team", {
    p_name: name.trim(),
    p_icon: icon,
  });

  if (error) return { error: translate(error.message) };

  refresh();
  return { notice: "Takım kuruldu." };
}

export async function joinTeamAction(code: string): Promise<TeamState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_team", {
    p_code: code.trim().toUpperCase(),
  });

  if (error) return { error: translate(error.message) };

  refresh();
  return { notice: "Takıma katıldın." };
}

export async function leaveTeamAction(): Promise<TeamState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_team");

  if (error) return { error: translate(error.message) };

  refresh();
  return { notice: "Takımdan ayrıldın." };
}

export async function kickMemberAction(userId: string): Promise<TeamState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("kick_member", { p_user: userId });

  if (error) return { error: translate(error.message) };

  refresh();
  return { notice: "Üye takımdan çıkarıldı." };
}

export async function transferCaptainAction(
  userId: string,
): Promise<TeamState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_captain", { p_user: userId });

  if (error) return { error: translate(error.message) };

  refresh();
  return { notice: "Kaptanlık devredildi." };
}
