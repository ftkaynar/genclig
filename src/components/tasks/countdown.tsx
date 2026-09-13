"use client";

import { useEffect, useState } from "react";

import { formatRemaining, nextTickDelay } from "@/lib/tasks/labels";

/**
 * Anlık görevlerin geri sayımı.
 *
 * İlk değer sunucuda hesaplanıp prop olarak geliyor; client de ilk render'da
 * aynı metni basıyor, böylece hydration ayrışmıyor. Güncelleme yalnızca
 * zamanlayıcı içinde yapılıyor — effect gövdesinde senkron setState çağırmak
 * cascading render üretir ve lint bunu hata sayıyor.
 *
 * Zamanlayıcı setInterval değil setTimeout zinciri: aralık kalan süreye göre
 * değişiyor (son dakikada saniyede, öncesinde dakikada), sabit aralıklı bir
 * interval bunu veremezdi.
 */
export function Countdown({
  endsAt,
  initialLabel,
  className,
}: {
  endsAt: string;
  initialLabel: string;
  className?: string;
}) {
  const [label, setLabel] = useState(initialLabel);

  useEffect(() => {
    const target = new Date(endsAt).getTime();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      const msLeft = target - Date.now();
      setLabel(formatRemaining(msLeft));

      const delay = nextTickDelay(msLeft);
      if (delay !== null) {
        timer = setTimeout(schedule, delay);
      }
    };

    const firstDelay = nextTickDelay(target - Date.now());
    if (firstDelay !== null) {
      timer = setTimeout(schedule, firstDelay);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [endsAt]);

  return (
    <span className={className} suppressHydrationWarning>
      {label}
    </span>
  );
}
