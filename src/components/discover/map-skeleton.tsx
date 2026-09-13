"use client";

import { useEffect, useState } from "react";

/*
  Harita yer tutucusu.

  Bilerek ayrı dosyada: task-map.tsx modül düzeyinde leaflet'i içe aktarıyor
  ve leaflet yüklenirken window'a dokunuyor. Yer tutucu oradan import edilince
  dynamic(ssr:false) sarmalaması devreye girmeden leaflet sunucuda
  değerlendiriliyor ve sayfa "window is not defined" ile 500 veriyordu.
*/
export function MapSkeleton() {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const timer = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "." : prev + "."));
    }, 400);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex h-72 w-full items-center justify-center rounded-2xl border border-edge bg-card text-sm text-ink-muted">
      Harita yükleniyor{dots}
    </div>
  );
}
