"use client";

import { useEffect, useRef } from "react";

import { markAllNotificationsReadAction } from "@/lib/notifications/actions";

/*
  Bildirimler sayfası açılınca okunmamışları işaretler.

  ÖLÇÜLEN SORUN (D30 FAZ N): sayfayı açmak sayacı sıfırlamıyordu;
  kullanıcı listeyi okuduktan sonra bile çan üstündeki kırmızı sayı
  duruyor ve ayrıca "Tümünü okundu işaretle" düğmesine basmak
  gerekiyordu. Okunan bir listenin okunmamış sayılması, sayacı
  anlamsızlaştırıyordu.

  Neden ayrı bir client bileşeni: sunucu bileşeninin render'ı sırasında
  yazma yapmak yanlış — her yeniden render'da tekrar koşar ve Next
  render'ı saf sayar. Effect bir kez çalışıyor.

  `ran` bayrağı React 18+ geliştirme modundaki çift çağrıya karşı:
  eylem iki kez gitse de zararsız (idempotent) ama gereksiz bir tur.

  Burada setState YOK; `react-hooks/set-state-in-effect` kuralına
  takılmıyor (D22 ve D29'da aynı kurala takılmıştık).
*/
export function MarkReadOnOpen({ unread }: { unread: number }) {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || unread === 0) {
      return;
    }
    ran.current = true;
    void markAllNotificationsReadAction();
  }, [unread]);

  return null;
}
