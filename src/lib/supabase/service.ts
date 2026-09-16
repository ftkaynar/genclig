import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
  service_role istemcisi — RLS'i atlıyor.

  YALNIZCA sunucu tarafında ve yalnızca RLS'in kasten engellediği işler
  için: push abonelikleri başkasının satırında okunmak zorunda (görevi
  onaylayan personel, bildirimi alan kullanıcı).

  `server-only` importu kasıtlı: bu dosya yanlışlıkla bir client
  bileşeninden import edilirse DERLEME KIRILIYOR. Anahtarın tarayıcıya
  sızması sessiz bir hata olsaydı fark edilmeyebilirdi.

  Anahtar yoksa null dönüyor ve çağıran işlemi atlıyor: yerel geliştirmede
  service key ayarlı olmayabilir ve bu yüzden uygulamanın çökmesi doğru
  değil.
*/
export function createServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
