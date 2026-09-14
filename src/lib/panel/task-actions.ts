"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type TaskSaveState = { error?: string; notice?: string; id?: string };

type Input = {
  id?: string;
  title: string;
  description: string;
  instructions: string;
  type: string;
  categoryId: string;
  verification: string;
  difficulty: string;
  taskScope: string;
  minTeamSize: string;
  teamBonusXp: string;
  teamBonusCoin: string;
  icon: string;
  xp: string;
  coin: string;
  startsAt: string;
  endsAt: string;
  lat: string;
  lng: string;
  radiusM: string;
  capacity: string;
  imageUrl: string;
  status: string;
  scope: "panel" | "admin";
};

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** datetime-local değerini ISO damgasına çevirir; boşsa null. */
function toIsoOrNull(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/*
  Görev kaydetme.

  Yetki RLS'te: tasks politikaları personeli kendi belediyesiyle, global
  görevleri süper adminle sınırlıyor. Burada ayrıca kontrol edilmiyor, ama
  yazma 0 satır etkilerse sessiz geçmesin diye sonuç kontrol ediliyor.

  municipality_id sunucuda belirleniyor, formdan gelmiyor: kullanıcının
  gönderdiği bir belediye kimliğine güvenmek, personelin başka belediyeye
  görev yazabilmesi demekti. Panelde çağıranın belediyesi okunuyor, adminde
  null (global görev).
*/
export async function saveTaskAction(input: Input): Promise<TaskSaveState> {
  const supabase = await createClient();

  const title = input.title.trim();
  const description = input.description.trim();

  if (title.length < 5) {
    return { error: "Başlık en az 5 karakter olmalı." };
  }
  if (description.length < 15) {
    return { error: "Açıklama en az 15 karakter olmalı." };
  }
  if (!input.categoryId) {
    return { error: "Kategori seçmelisin." };
  }

  const xp = toNumberOrNull(input.xp) ?? 0;
  const coin = toNumberOrNull(input.coin) ?? 0;
  if (xp < 0 || coin < 0) {
    return { error: "Ödül değerleri negatif olamaz." };
  }

  const endsAt = toIsoOrNull(input.endsAt);
  if (input.type === "instant" && !endsAt) {
    return { error: "Anlık görevde bitiş zamanı zorunlu." };
  }

  /*
    Takım görevi doğrulaması.

    Eşik sunucuda zorunlu: form alanı gizlenebilir ya da istek elle
    yazılabilir, oysa min_team_size olmadan award_task_points varsayılan 2
    ile çalışır ve yönetici hiç istemediği bir eşik almış olur. Bonusu
    sıfır olan takım görevi de anlamsız — takımca tamamlamanın karşılığı
    bireysel ödülle aynı kalırdı.
  */
  const isTeamTask = input.taskScope === "team";
  const minTeamSize = toNumberOrNull(input.minTeamSize);
  const teamBonusXp = toNumberOrNull(input.teamBonusXp) ?? 0;
  const teamBonusCoin = toNumberOrNull(input.teamBonusCoin) ?? 0;

  if (isTeamTask) {
    if (minTeamSize === null || minTeamSize < 2 || minTeamSize > 10) {
      return { error: "Takım görevinde eşik 2 ile 10 arasında olmalı." };
    }
    if (teamBonusXp < 0 || teamBonusCoin < 0) {
      return { error: "Takım bonusu negatif olamaz." };
    }
    if (teamBonusXp === 0 && teamBonusCoin === 0) {
      return { error: "Takım görevinde en az bir bonus değeri girmelisin." };
    }
  }

  const needsLocation =
    input.verification === "gps" || input.verification === "photo_gps";
  const lat = toNumberOrNull(input.lat);
  const lng = toNumberOrNull(input.lng);

  if (needsLocation && (lat === null || lng === null)) {
    return { error: "Konum doğrulamalı görevde enlem ve boylam zorunlu." };
  }

  let municipalityId: string | null = null;

  if (input.scope === "panel") {
    const { data } = await supabase.rpc("my_municipalities");
    const rows = (data ?? []) as { municipality_id: string }[];
    if (rows.length === 0) {
      return { error: "Belediye yetkin bulunamadı." };
    }
    municipalityId = rows[0].municipality_id;
  }

  const payload = {
    title,
    description,
    instructions: input.instructions.trim() || null,
    type: input.type,
    category_id: Number(input.categoryId),
    verification: input.verification,
    difficulty: input.difficulty,
    scope: isTeamTask ? "team" : "individual",
    min_team_size: isTeamTask ? minTeamSize : null,
    team_bonus_xp: isTeamTask ? teamBonusXp : 0,
    team_bonus_coin: isTeamTask ? teamBonusCoin : 0,
    icon: input.icon.trim() || null,
    xp,
    coin,
    starts_at: toIsoOrNull(input.startsAt),
    ends_at: endsAt,
    lat: needsLocation ? lat : null,
    lng: needsLocation ? lng : null,
    radius_m: needsLocation ? toNumberOrNull(input.radiusM) : null,
    capacity: toNumberOrNull(input.capacity),
    image_url: input.imageUrl.trim() || null,
    status: input.status,
  };

  const { data, error } = input.id
    ? await supabase
        .from("tasks")
        .update(payload)
        .eq("id", input.id)
        .select("id")
    : await supabase
        .from("tasks")
        .insert({ ...payload, municipality_id: municipalityId })
        .select("id");

  if (error || !data || data.length === 0) {
    return {
      error: "Görev kaydedilemedi. Yetkin olmayabilir ya da alanlar eksik.",
    };
  }

  revalidatePath("/panel/gorevler");
  revalidatePath("/admin/gorevler");
  revalidatePath("/gorevler");

  return { notice: "Görev kaydedildi.", id: data[0].id };
}

/** Ödülü arşivler; hiç kullanılmamışsa gerçekten siler. */
export async function archiveRewardAction(
  rewardId: string,
): Promise<TaskSaveState> {
  const supabase = await createClient();

  // Kullanılmış ödülü silmek, kuponların bağlı olduğu satırı yok etmek
  // demekti; kupon geçmişi okunamaz hale gelirdi.
  const { count } = await supabase
    .from("reward_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("reward_id", rewardId);

  if ((count ?? 0) > 0) {
    const { data, error } = await supabase
      .from("rewards")
      .update({ status: "archived" })
      .eq("id", rewardId)
      .select("id");

    if (error || !data || data.length === 0) {
      return { error: "Ödül arşivlenemedi." };
    }

    revalidatePath("/admin/oduller");
    revalidatePath("/panel/oduller");
    revalidatePath("/oduller");
    return { notice: "Ödül arşivlendi (kupon geçmişi korundu)." };
  }

  const { data, error } = await supabase
    .from("rewards")
    .delete()
    .eq("id", rewardId)
    .select("id");

  if (error || !data || data.length === 0) {
    return { error: "Ödül silinemedi." };
  }

  revalidatePath("/admin/oduller");
  revalidatePath("/panel/oduller");
  revalidatePath("/oduller");
  return { notice: "Ödül silindi." };
}

/** Rozeti pasife alır. Kazanılmış rozetler silinmiyor, geçmiş korunuyor. */
export async function setBadgeStatusAction(
  badgeId: string,
  status: string,
): Promise<TaskSaveState> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("badges")
    .update({ status })
    .eq("id", badgeId)
    .select("id");

  if (error || !data || data.length === 0) {
    return { error: "Rozet güncellenemedi." };
  }

  revalidatePath("/admin/rozetler");
  return { notice: status === "active" ? "Rozet aktif." : "Rozet pasife alındı." };
}
