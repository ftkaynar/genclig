import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "./env";

/**
 * Tarayıcı tarafı Supabase client'ı.
 * Sadece anon key kullanır; yetki kontrolü RLS ile veritabanında yapılır.
 * Puan/coin gibi iş mantığı burada ASLA yazılmaz (bkz. AGENTS.md).
 */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
