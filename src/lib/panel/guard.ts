import { createClient } from "@/lib/supabase/server";

export type PanelContext = {
  userId: string;
  municipalityId: string;
  municipalityName: string;
  role: string;
};

/**
 * Panel erişim bağlamı.
 *
 * null dönerse kullanıcının hiçbir belediyede yetkisi yok; sayfalar bu durumda
 * yönlendirme yerine açıklayıcı bir ekran gösteriyor. Yönlendirme, yetkisi
 * olmayan kullanıcıyı sessizce başka bir yere atıp ne olduğunu anlatmıyordu.
 *
 * Birden fazla belediyede yetkili kullanıcı için ilki seçiliyor; belediye
 * değiştirme sonraki dilimlerin işi.
 */
export async function getPanelContext(): Promise<PanelContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.rpc("my_municipalities");
  const rows = (data ?? []) as {
    municipality_id: string;
    name: string;
    role: string;
  }[];

  if (rows.length === 0) return null;

  return {
    userId: user.id,
    municipalityId: rows[0].municipality_id,
    municipalityName: rows[0].name,
    role: rows[0].role,
  };
}

export async function isSuperAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .maybeSingle();

  return Boolean(data);
}
