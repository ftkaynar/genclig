import { cache } from "react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/*
  İstek başına tek oturum doğrulaması.

  Ölçüm: `auth.getUser()` kod tabanında 22 ayrı yerde çağrılıyordu ve tek
  bir sayfa isteğinde aynı kullanıcı için 3–4 kez ağ turu atılıyordu
  (sayfa bileşeni + listNotifications + getSubmissionMap + panel/guard gibi).
  Her tur Supabase'e gerçek bir HTTP isteği; bölge hizalaması öncesinde
  turu ~250 ms'ti.

  React `cache()` aynı istek içinde ilk sonucu tutuyor, sonraki çağrılar
  ağa çıkmıyor. İstekler arası paylaşım yok — bu bir önbellek değil,
  istek kapsamlı hafıza; bir kullanıcının oturumu başkasının isteğine
  sızmıyor.

  `getUser()` bilerek korunuyor, `getSession()` değil: getSession çerezdeki
  veriyi doğrulamadan döndürüyor. Yetki kararı doğrulanmamış veriye
  dayanmamalı.

  Denenen ve elenen alternatif: kullanıcıyı sayfa bileşeninden aşağıya
  parametre olarak geçirmek. Elendi, çünkü her sorgu fonksiyonunun imzasını
  değiştirmek gerekiyordu ve bir yerde unutulduğunda sessizce eski
  davranışa dönüyordu.
*/
export const getViewerUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export type ViewerProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  birth_date: string | null;
  phone: string | null;
  province_id: number | null;
  district_id: number | null;
  neighborhood_id: number | null;
};

/** Oturum sahibinin profili; istek başına bir kez okunur. */
export const getViewerProfile = cache(
  async (): Promise<ViewerProfile | null> => {
    const user = await getViewerUser();
    if (!user) return null;

    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select(
        "id,username,display_name,avatar_url,birth_date,phone,province_id,district_id,neighborhood_id",
      )
      .eq("id", user.id)
      .maybeSingle();

    return (data as ViewerProfile) ?? null;
  },
);
