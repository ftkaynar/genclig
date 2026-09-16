"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
} from "@/lib/push/actions";

/*
  Bildirim izni anahtarı.

  Tarayıcı izni SENKRON okunamıyor ve kullanıcı jesti olmadan
  istenemiyor; bu yüzden durum düğmeye basılana kadar "bilinmiyor"
  kalıyor. `Notification.permission`'ı render sırasında okumak sunucu
  HTML'i ile uyuşmazlık yaratıyordu (sunucuda böyle bir API yok).

  Denenen ve elenen: sayfa açılır açılmaz izin istemek. Tarayıcılar
  jestsiz istekleri sessizce reddediyor ve kullanıcı bir daha
  sorulmuyor — izin bir kez harcanıyor, boşa harcanmamalı.
*/

/**
 * base64url VAPID anahtarını PushManager'ın beklediği tampona çevirir.
 *
 * Dönüş tipi `ArrayBuffer`: `PushManager.subscribe` imzası
 * `Uint8Array<ArrayBufferLike>` kabul etmiyor (SharedArrayBuffer
 * ihtimali yüzünden, ölçüldü). Tamponun kendisini vermek hem tip olarak
 * doğru hem de fazladan kopya üretmiyor.
 */
function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output.buffer as ArrayBuffer;
}

type State = "idle" | "working" | "on" | "off" | "denied" | "unsupported";

export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>("idle");
  const [note, setNote] = useState<string | null>(null);

  async function enable() {
    setNote(null);

    if (!publicKey) {
      setState("unsupported");
      setNote("Sunucuda bildirim anahtarı tanımlı değil.");
      return;
    }
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setState("unsupported");
      setNote("Tarayıcın bildirimi desteklemiyor.");
      return;
    }

    setState("working");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        setNote(
          "İzin verilmedi. Tarayıcı ayarlarından site bildirimlerini açabilirsin.",
        );
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      const sub =
        existing ??
        (await registration.pushManager.subscribe({
          // Sessiz push tarayıcılarca reddediliyor; her push görünür
          // bir bildirim üretmek zorunda.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const json = sub.toJSON();
      const result = await savePushSubscriptionAction({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });

      if (result.error) {
        setState("off");
        setNote(result.error);
        return;
      }

      setState("on");
      setNote("Bildirimler açık. Görevin onaylandığında haber vereceğiz.");
    } catch (error) {
      console.error("[push] abone olunamadı:", error);
      setState("off");
      setNote("Bildirim açılamadı. Tekrar dene.");
    }
  }

  async function disable() {
    setState("working");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const sub = await registration?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      setNote("Bildirimler kapatıldı.");
    } catch (error) {
      console.error("[push] kapatılamadı:", error);
      setNote("Bildirim kapatılamadı.");
      setState("on");
    }
  }

  const on = state === "on";

  return (
    <div>
      <button
        type="button"
        onClick={on ? disable : enable}
        disabled={state === "working"}
        className={`btn-chunky flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-all disabled:opacity-60 ${
          on
            ? "bg-status-success text-white"
            : "brand-gradient text-white"
        }`}
      >
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Icon name="bell" className="h-4.5 w-4.5" />
          </span>
          <span>
            <span className="block text-sm font-bold">
              {on ? "Bildirimler açık" : "Bildirimlere izin ver"}
            </span>
            <span className="block text-[11px] text-white/85">
              {on
                ? "Kapatmak için dokun"
                : "Görev onayı, ödül ve duyurulardan anında haberdar ol"}
            </span>
          </span>
        </span>
        <Icon
          name={on ? "check" : "chevron-right"}
          className="h-5 w-5 shrink-0"
        />
      </button>

      {note ? (
        <p role="status" className="mt-2 text-xs text-ink-muted">
          {note}
        </p>
      ) : null}
    </div>
  );
}
