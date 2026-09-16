"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { Icon } from "@/components/ui/icon";

/*
  Bildirim teşvik kartı (D32 FAZ D3).

  ÖLÇÜLEN EKSİK: izin akışı yalnız /ayarlar'daki anahtarla başlıyordu ve
  ana sayfada hiçbir teşvik yoktu — kullanıcı bildirimlerin var olduğunu
  bile bilmiyordu.

  Kart KAPATILABİLİR ve kapatma kalıcı: kapatılamayan bir teşvik, birkaç
  gün sonra gürültüye dönüşüyor. Aynı sebeple izin zaten verilmişse ya da
  reddedilmişse hiç gösterilmiyor.

  İzni BURADA istemiyoruz: kart /ayarlar'a götürüyor. Tarayıcılar jestsiz
  izin isteklerini sessizce reddediyor ve izin bir kez harcanıyor —
  kullanıcı anahtarı bilinçli olarak açtığında istemek daha sağlam.
*/

const KEY = "genclig-push-nudge-dismissed";

/*
  Görünürlük kararı bir DIŞ DEPO: sunucuda Notification API'si de
  localStorage da yok. useSyncExternalStore sunucu anlık görüntüsünü ayrı
  aldığı için hydration uyuşmazlığı çıkmıyor (aynı kalıp arrival.tsx'te).
*/
function createNudgeStore() {
  let snapshot: boolean | undefined;
  return {
    subscribe: () => () => {},
    get: (): boolean => {
      if (snapshot === undefined) {
        try {
          const dismissed = localStorage.getItem(KEY) === "1";
          const supported =
            "Notification" in window && "serviceWorker" in navigator;
          const undecided =
            supported && Notification.permission === "default";
          snapshot = !dismissed && undecided;
        } catch {
          // Gizli sekme / engelli site verisi: teşvik gösterilmiyor.
          snapshot = false;
        }
      }
      return snapshot;
    },
  };
}

export function PushNudge() {
  const [store] = useState(createNudgeStore);
  const shouldShow = useSyncExternalStore(
    store.subscribe,
    store.get,
    () => false,
  );
  const [closed, setClosed] = useState(false);

  if (!shouldShow || closed) {
    return null;
  }

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // Kaydedilemezse de kart bu oturumda kapanıyor.
    }
    setClosed(true);
  }

  return (
    <div className="anim-stagger mb-3 flex items-center gap-2.5 rounded-2xl border border-primary/40 bg-primary/10 px-3.5 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
        <Icon name="bell" className="h-4.5 w-4.5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold text-ink">
          Bildirimleri aç
        </span>
        <span className="block text-[11px] text-ink-muted">
          Görevin onaylandığında anında haberin olsun.
        </span>
      </span>

      <Link
        href="/ayarlar"
        className="press-soft inline-flex min-h-[40px] shrink-0 items-center rounded-full bg-primary px-3.5 text-[12px] font-bold text-white"
      >
        Aç
      </Link>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Kapat"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-muted"
      >
        <Icon name="x" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
