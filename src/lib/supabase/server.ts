import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
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

/**
 * Oturumsuz, çerezsiz Supabase client'ı.
 *
 * Neden ayrı: `createClient()` `cookies()` çağırıyor ve Next.js
 * `unstable_cache` içinde çerez okumaya izin vermiyor ("Route used cookies
 * inside unstable_cache"). Referans verisi (iller, kategoriler, seviyeler,
 * rozetler, SSS) zaten anon'a açık ve kullanıcıya göre değişmiyor, bu
 * yüzden oturumsuz okunabiliyor.
 *
 * Buraya kullanıcıya özel sorgu YAZILMAZ: oturum taşınmadığı için RLS
 * çağıranı anon sayar ve kişisel satırlar zaten görünmez.
 */
export function createPublicClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
