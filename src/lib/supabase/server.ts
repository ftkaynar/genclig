import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseEnv } from "./env";

/**
 * Sunucu tarafı Supabase client'ı (Server Component, Route Handler, Server Action).
 * Oturum cookie'leri Next'in cookie store'u üzerinden taşınır.
 */
export async function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component içinden cookie yazılamaz. Oturum yenilemesi
          // middleware tarafında yapıldığı sürece bu hata güvenle yutulabilir.
        }
      },
    },
  });
}
