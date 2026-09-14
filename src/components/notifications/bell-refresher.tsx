"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Bildirim sayacını arka planda tazeler.
 *
 * Sayaç sunucuda hesaplanıyor; sayfa yenilenmeden güncellenmesi için router
 * yenilemesi gerekiyor. Otuz saniye, "yeni bildirim geldi" duygusu için
 * yeterince sık ve sunucuya yük bindirmeyecek kadar seyrek.
 *
 * Sekme arka plandayken yenileme yapılmıyor: kullanıcı bakmıyorken istek
 * atmanın kimseye faydası yok, mobilde pili yiyor.
 *
 * Gerçek zamanlı abonelik (Supabase realtime) borçta; bu yaklaşım tek satır
 * ve hiçbir bağlantı açık tutmuyor.
 */
export function BellRefresher({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [router, intervalMs]);

  return null;
}
