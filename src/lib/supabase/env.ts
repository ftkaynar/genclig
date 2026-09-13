type SupabaseEnv = {
  url: string;
  anonKey: string;
};

/**
 * Supabase env değişkenlerini okur.
 * Neden ayrı dosya: env eksikken uygulamanın import anında çökmemesi için
 * kontrol modül seviyesinde değil, client oluşturulduğu anda yapılıyor.
 * Böylece /api/health gibi Supabase kullanmayan yollar env olmadan da çalışır.
 */
export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase yapılandırması eksik: NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlanmalı.",
    );
  }

  return { url, anonKey };
}

/** Env'in tam olup olmadığını hata fırlatmadan söyler. */
export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
