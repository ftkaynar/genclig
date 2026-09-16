"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ReferralAdminState = { error?: string; notice?: string };

/*
  Davet ayarları (D33 FAZ DV).

  Yetki RLS'te: referral_settings yazma politikası is_super_admin()
  istiyor. Burada ikinci bir kontrol yok — iki yerde duran bir yetki
  kuralı, birinin gevşemesi demek.
*/

function toInt(value: string): number {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

export async function saveReferralSettingsAction(input: {
  inviterXp: string;
  inviterToken: string;
  invitedXp: string;
  invitedToken: string;
  active: boolean;
}): Promise<ReferralAdminState> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("referral_settings")
    .update({
      inviter_xp: toInt(input.inviterXp),
      inviter_token: toInt(input.inviterToken),
      invited_xp: toInt(input.invitedXp),
      invited_token: toInt(input.invitedToken),
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) {
    if (
      error.message.includes("row-level security") ||
      error.message.includes("permission denied")
    ) {
      return { error: "Bu işlem için yetkin yok." };
    }
    return { error: "Ayarlar kaydedilemedi." };
  }

  revalidatePath("/admin/davet");
  // Davet kartı ödül metnini ayarlardan okuyor; o da tazelenmeli.
  revalidatePath("/arkadaslar");
  return { notice: "Davet ayarları kaydedildi." };
}
