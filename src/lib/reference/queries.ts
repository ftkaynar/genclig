import { unstable_cache } from "next/cache";

import { createPublicClient } from "@/lib/supabase/server";

/*
  Referans veri önbelleği.

  Bu tablolar herkes için aynı ve nadiren değişiyor: iller, ilçeler,
  mahalleler, görev/sorun kategorileri, seviye eşikleri, rozetler, SSS.
  Her istekte Sydney'e sorulmaları saf israftı.

  `unstable_cache` sonucu istekler arası tutuyor; `revalidate: 3600` bir
  saatlik tazelik penceresi veriyor. Yönetici bir kaydı değiştirdiğinde
  bir saat beklenmesin diye ilgili etiket `revalidateTag` ile
  geçersizleştiriliyor (bkz. `REFERENCE_TAGS` kullanıcıları).

  Önemli sınır: buraya yalnızca **kullanıcıya özel olmayan** veri girer.
  Önbellek istekler arası paylaşıldığı için kişisel bir satır buraya
  konsaydı başka kullanıcının isteğinde servis edilirdi.

  Denenen ve elenen alternatif: `export const revalidate` ile sayfa
  düzeyinde ISR. Elendi, çünkü sayfalar kişisel veri de içeriyor ve tüm
  sayfanın önbelleğe alınması kullanıcıya başkasının bakiyesini
  gösterebilirdi.
*/

export const REFERENCE_TAGS = {
  provinces: "ref-provinces",
  districts: "ref-districts",
  neighborhoods: "ref-neighborhoods",
  taskCategories: "ref-task-categories",
  problemCategories: "ref-problem-categories",
  levels: "ref-levels",
  badges: "ref-badges",
  faq: "ref-faq",
} as const;

const ONE_HOUR = 3600;

export type Province = { id: number; name: string };
export type District = { id: number; name: string };
export type Neighborhood = { id: number; name: string };
export type TaskCategoryRef = {
  id: number;
  slug: string;
  name: string;
  icon: string | null;
};
export type ProblemCategoryRef = { id: number; name: string };
export type LevelRef = { level: number; min_xp: number };
export type BadgeRef = { id: string; name: string };

export const getProvinces = unstable_cache(
  async (): Promise<Province[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("provinces")
      .select("id,name")
      .order("name");
    return (data ?? []) as Province[];
  },
  ["reference", "provinces"],
  { revalidate: ONE_HOUR, tags: [REFERENCE_TAGS.provinces] },
);

export const getDistricts = unstable_cache(
  async (provinceId: number): Promise<District[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("districts")
      .select("id,name")
      .eq("province_id", provinceId)
      .order("name");
    return (data ?? []) as District[];
  },
  ["reference", "districts"],
  { revalidate: ONE_HOUR, tags: [REFERENCE_TAGS.districts] },
);

export const getNeighborhoods = unstable_cache(
  async (districtId: number): Promise<Neighborhood[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("neighborhoods")
      .select("id,name")
      .eq("district_id", districtId)
      .order("name");
    return (data ?? []) as Neighborhood[];
  },
  ["reference", "neighborhoods"],
  { revalidate: ONE_HOUR, tags: [REFERENCE_TAGS.neighborhoods] },
);

export const getTaskCategories = unstable_cache(
  async (): Promise<TaskCategoryRef[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("task_categories")
      .select("id,slug,name,icon")
      .order("sort");
    return (data ?? []) as TaskCategoryRef[];
  },
  ["reference", "task-categories"],
  { revalidate: ONE_HOUR, tags: [REFERENCE_TAGS.taskCategories] },
);

export const getProblemCategories = unstable_cache(
  async (): Promise<ProblemCategoryRef[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("problem_categories")
      .select("id,name")
      .order("sort");
    return (data ?? []) as ProblemCategoryRef[];
  },
  ["reference", "problem-categories"],
  { revalidate: ONE_HOUR, tags: [REFERENCE_TAGS.problemCategories] },
);

export const getLevels = unstable_cache(
  async (): Promise<LevelRef[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("levels")
      .select("level,min_xp")
      .order("level");
    return (data ?? []) as LevelRef[];
  },
  ["reference", "levels"],
  { revalidate: ONE_HOUR, tags: [REFERENCE_TAGS.levels] },
);

export const getBadgeNames = unstable_cache(
  async (): Promise<BadgeRef[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase.from("badges").select("id,name");
    return (data ?? []) as BadgeRef[];
  },
  ["reference", "badges"],
  { revalidate: ONE_HOUR, tags: [REFERENCE_TAGS.badges] },
);

export type BadgeThreshold = {
  name: string;
  icon: string | null;
  /** `xp_total` kriterli rozetin XP eşiği. */
  amount: number;
};

/**
 * XP eşikli rozetler — Seviye Yolu'nda seviye düğümleriyle kesiştirmek
 * için.
 *
 * Yalnızca `xp_total` kriterli rozetler dönüyor; görev sayısı ya da
 * kategori kriterli rozetler XP'ye çevrilemiyor ve uydurma bir eşleştirme
 * kullanıcıya yanlış hedef gösterirdi.
 */
export const getXpBadgeThresholds = unstable_cache(
  async (): Promise<BadgeThreshold[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("badges")
      .select("name,icon,criteria")
      .eq("status", "active");

    const rows = (data ?? []) as {
      name: string;
      icon: string | null;
      criteria: { type?: string; amount?: number } | null;
    }[];

    return rows
      .filter(
        (row) =>
          row.criteria?.type === "xp_total" &&
          typeof row.criteria.amount === "number",
      )
      .map((row) => ({
        name: row.name,
        icon: row.icon,
        amount: row.criteria!.amount as number,
      }));
  },
  ["reference", "xp-badges"],
  { revalidate: ONE_HOUR, tags: [REFERENCE_TAGS.badges] },
);
