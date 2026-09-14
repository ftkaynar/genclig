"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { REFERENCE_TAGS } from "@/lib/reference/queries";
import { createClient } from "@/lib/supabase/server";

export type AdminActionState = { error?: string; notice?: string };

/*
  Süper admin işlemleri.

  Hepsi doğrudan tabloya yazıyor; yetki RLS politikalarında (is_super_admin).
  Ayrı bir fonksiyon katmanı eklenmedi çünkü bu işlemlerin iş kuralı yok,
  yalnızca kayıt düzenleme. Yetkisiz çağrı 0 satır etkiliyor ve sessiz
  geçmesin diye sonuç kontrol ediliyor.
*/

function failed(data: unknown[] | null, error: unknown): boolean {
  return Boolean(error) || !data || data.length === 0;
}

export async function upsertMunicipalityAction(input: {
  id?: string;
  name: string;
  slug: string;
  level: string;
  provinceId: number;
  districtId: number | null;
  status: string;
}): Promise<AdminActionState> {
  const supabase = await createClient();

  const payload = {
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase(),
    level: input.level,
    province_id: input.provinceId,
    district_id: input.districtId,
    status: input.status,
  };

  if (!payload.name || !payload.slug) {
    return { error: "Ad ve kısa ad zorunlu." };
  }

  const { data, error } = input.id
    ? await supabase
        .from("municipalities")
        .update(payload)
        .eq("id", input.id)
        .select("id")
    : await supabase.from("municipalities").insert(payload).select("id");

  if (failed(data, error)) {
    return { error: "Kaydedilemedi. Kısa ad benzersiz olmalı." };
  }

  revalidatePath("/admin/belediyeler");
  return { notice: "Belediye kaydedildi." };
}

/** Kullanıcıya belediye rolü verir ya da alır. */
export async function setUserRoleAction(input: {
  userId: string;
  role: string;
  municipalityId: string | null;
  grant: boolean;
}): Promise<AdminActionState> {
  const supabase = await createClient();

  if (input.grant) {
    const { data, error } = await supabase
      .from("user_roles")
      .insert({
        user_id: input.userId,
        role: input.role,
        municipality_id: input.municipalityId,
      })
      .select("id");

    if (failed(data, error)) {
      return { error: "Rol verilemedi. Zaten tanımlı olabilir." };
    }
  } else {
    let query = supabase
      .from("user_roles")
      .delete()
      .eq("user_id", input.userId)
      .eq("role", input.role);

    query =
      input.municipalityId === null
        ? query.is("municipality_id", null)
        : query.eq("municipality_id", input.municipalityId);

    const { data, error } = await query.select("id");

    if (failed(data, error)) {
      return { error: "Rol alınamadı." };
    }
  }

  revalidatePath("/admin/kullanicilar");
  return { notice: input.grant ? "Rol verildi." : "Rol alındı." };
}

export async function updateLevelAction(
  level: number,
  minXp: number,
): Promise<AdminActionState> {
  const supabase = await createClient();

  if (level === 1 && minXp !== 0) {
    return { error: "1. seviyenin eşiği 0 olmak zorunda." };
  }

  // Eşikler artan olmalı: bir seviyenin eşiği komşularının arasında kalmalı,
  // yoksa level_from_xp'nin "en yüksek eşik" araması sıraları karıştırır.
  const { data: neighbours } = await supabase
    .from("levels")
    .select("level,min_xp")
    .in("level", [level - 1, level + 1]);

  for (const row of neighbours ?? []) {
    if (row.level === level - 1 && minXp <= row.min_xp) {
      return { error: `Eşik bir önceki seviyeden (${row.min_xp}) büyük olmalı.` };
    }
    if (row.level === level + 1 && minXp >= row.min_xp) {
      return { error: `Eşik bir sonraki seviyeden (${row.min_xp}) küçük olmalı.` };
    }
  }

  const { data, error } = await supabase
    .from("levels")
    .update({ min_xp: minXp })
    .eq("level", level)
    .select("level");

  if (failed(data, error)) {
    return { error: "Eşik güncellenemedi." };
  }

  revalidatePath("/admin/seviyeler");
  // Referans önbelleği saatlik; yönetici düzenlemesi anında görünsün.
  // Next 16 revalidateTag ikinci argüman istiyor; "max" = etiketi tamamen
  // geçersiz kıl.
  revalidateTag(REFERENCE_TAGS.levels, "max");
  return { notice: `Seviye ${level} eşiği ${minXp} XP oldu.` };
}

export async function upsertBadgeAction(input: {
  id?: string;
  slug: string;
  name: string;
  description: string;
  criteria: string;
  xpBonus: number;
  coinBonus: number;
  status: string;
}): Promise<AdminActionState> {
  const supabase = await createClient();

  let criteria: unknown;
  try {
    criteria = JSON.parse(input.criteria);
  } catch {
    return { error: "Kriter geçerli JSON olmalı." };
  }

  const payload = {
    slug: input.slug.trim(),
    name: input.name.trim(),
    description: input.description.trim(),
    criteria,
    xp_bonus: input.xpBonus,
    coin_bonus: input.coinBonus,
    status: input.status,
  };

  const { data, error } = input.id
    ? await supabase.from("badges").update(payload).eq("id", input.id).select("id")
    : await supabase.from("badges").insert(payload).select("id");

  if (failed(data, error)) {
    return { error: "Rozet kaydedilemedi. Kısa ad benzersiz olmalı." };
  }

  revalidatePath("/admin/rozetler");
  revalidateTag(REFERENCE_TAGS.badges, "max");
  return { notice: "Rozet kaydedildi." };
}

export async function upsertRewardAction(input: {
  id?: string;
  title: string;
  description: string;
  coinCost: number;
  minLevel: number;
  stock: number | null;
  status: string;
}): Promise<AdminActionState> {
  const supabase = await createClient();

  const payload = {
    title: input.title.trim(),
    description: input.description.trim(),
    coin_cost: input.coinCost,
    min_level: input.minLevel,
    stock: input.stock,
    status: input.status,
    municipality_id: null,
  };

  if (payload.coin_cost <= 0) {
    return { error: "Coin bedeli sıfırdan büyük olmalı." };
  }

  const { data, error } = input.id
    ? await supabase.from("rewards").update(payload).eq("id", input.id).select("id")
    : await supabase.from("rewards").insert(payload).select("id");

  if (failed(data, error)) {
    return { error: "Ödül kaydedilemedi." };
  }

  revalidatePath("/admin/oduller");
  revalidatePath("/oduller");
  return { notice: "Ödül kaydedildi." };
}

export async function upsertTaskCategoryAction(input: {
  id?: number;
  slug: string;
  name: string;
  sort: number;
}): Promise<AdminActionState> {
  const supabase = await createClient();

  const payload = {
    slug: input.slug.trim(),
    name: input.name.trim(),
    sort: input.sort,
  };

  const { data, error } = input.id
    ? await supabase
        .from("task_categories")
        .update(payload)
        .eq("id", input.id)
        .select("id")
    : await supabase.from("task_categories").insert(payload).select("id");

  if (failed(data, error)) {
    return { error: "Kategori kaydedilemedi." };
  }

  revalidatePath("/admin/kategoriler");
  revalidateTag(REFERENCE_TAGS.taskCategories, "max");
  return { notice: "Kategori kaydedildi." };
}

export async function upsertProblemCategoryAction(input: {
  id?: number;
  slug: string;
  name: string;
  sort: number;
}): Promise<AdminActionState> {
  const supabase = await createClient();

  const payload = {
    slug: input.slug.trim(),
    name: input.name.trim(),
    sort: input.sort,
  };

  const { data, error } = input.id
    ? await supabase
        .from("problem_categories")
        .update(payload)
        .eq("id", input.id)
        .select("id")
    : await supabase.from("problem_categories").insert(payload).select("id");

  if (failed(data, error)) {
    return { error: "Kategori kaydedilemedi." };
  }

  revalidatePath("/admin/kategoriler");
  revalidateTag(REFERENCE_TAGS.problemCategories, "max");
  return { notice: "Kategori kaydedildi." };
}
