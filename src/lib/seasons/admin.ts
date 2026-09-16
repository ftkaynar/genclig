"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type SeasonAdminState = { error?: string; notice?: string };

export type AdminSeasonRow = {
  id: number;
  name: string;
  starts_at: string;
  ends_at: string;
  theme: string;
  status: string;
  badge_awarded: boolean;
};

/*
  Sezon yönetimi (D33 FAZ SZ).

  Yetki RLS'te (seasons yazma politikası is_super_admin). Burada ikinci
  bir kontrol yok — iki yerde duran bir yetki kuralı, birinin gevşemesi
  demek.
*/

function refresh() {
  revalidatePath("/admin/sezonlar");
  revalidatePath("/profil");
  revalidatePath("/siralama");
}

function translate(message: string): string {
  if (
    message.includes("row-level security") ||
    message.includes("permission denied")
  ) {
    return "Bu işlem için yetkin yok.";
  }
  if (message.includes("seasons_check") || message.includes("ends_at")) {
    return "Bitiş tarihi başlangıçtan sonra olmalı.";
  }
  return "İşlem tamamlanamadı.";
}

export async function saveSeasonAction(input: {
  id?: number;
  name: string;
  startsAt: string;
  endsAt: string;
  theme: string;
  status: string;
}): Promise<SeasonAdminState> {
  const supabase = await createClient();

  const name = input.name.trim();
  if (name.length < 2) {
    return { error: "Sezon adı en az 2 karakter olmalı." };
  }
  if (!input.startsAt || !input.endsAt) {
    return { error: "Başlangıç ve bitiş tarihi zorunlu." };
  }

  /*
    datetime-local değeri yerel saat; +03:00 açıkça ekleniyor.

    Türkiye 2016'dan beri sabit UTC+03:00. Tarayıcının saat dilimine
    güvenmek denendi ve elendi — yönetici yurt dışından girdiğinde
    sezon sınırı kayıyordu.
  */
  const toIso = (value: string) => new Date(`${value}:00+03:00`).toISOString();

  const payload = {
    name,
    starts_at: toIso(input.startsAt),
    ends_at: toIso(input.endsAt),
    theme: input.theme,
    status: input.status,
  };

  const { error } = input.id
    ? await supabase.from("seasons").update(payload).eq("id", input.id)
    : await supabase.from("seasons").insert(payload);

  if (error) return { error: translate(error.message) };

  refresh();
  return { notice: "Sezon kaydedildi." };
}

/**
 * Biten sezonların rozetlerini şimdi dağıtır.
 *
 * Cron zaten günde bir çalışıyor; bu düğme yöneticinin beklemesini
 * engelliyor. Fonksiyon idempotent (badge_awarded bayrağı +
 * user_badges birincil anahtarı), bu yüzden kaç kez basıldığı önemsiz.
 */
export async function settleSeasonsAction(): Promise<SeasonAdminState> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("settle_season_badges");

  if (error) return { error: translate(error.message) };

  refresh();
  const count = typeof data === "number" ? data : 0;
  return {
    notice:
      count > 0
        ? `${count} kullanıcıya sezon rozeti verildi.`
        : "Dağıtılacak yeni rozet yok.",
  };
}
