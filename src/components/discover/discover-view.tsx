"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

import { MapSkeleton } from "./map-skeleton";
import type { DiscoverTask } from "@/lib/discover/queries";

/*
  Harita yalnızca tarayıcıda yükleniyor (ssr: false).

  Leaflet doğrudan window ve document'e erişiyor; sunucuda render edilmeye
  çalışıldığında derleme kırılıyor. dynamic import bunun standart çözümü.
*/
const TaskMap = dynamic(
  () => import("./task-map").then((mod) => mod.TaskMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

/** İki nokta arası mesafe (metre), haversine. */
function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}

function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

export function DiscoverView({ tasks }: { tasks: DiscoverTask[] }) {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function locate() {
    setError(null);

    if (!("geolocation" in navigator)) {
      setError("Bu cihaz konum bilgisi vermiyor.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition([result.coords.latitude, result.coords.longitude]);
        setLocating(false);
      },
      (positionError) => {
        setLocating(false);
        setError(
          positionError.code === positionError.PERMISSION_DENIED
            ? "Konum izni verilmedi. Görevleri haritadan gezebilirsin."
            : "Konumun alınamadı.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  // Mesafe listesi konum varsa sıralı, yoksa görev sırasında.
  const nearby = useMemo(() => {
    if (!position) return tasks.map((task) => ({ task, distance: null }));

    return tasks
      .map((task) => ({
        task,
        distance: distanceMeters(position[0], position[1], task.lat, task.lng),
      }))
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }, [tasks, position]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          Konumlu görevler haritada işaretli.
        </p>
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="shrink-0 rounded-full border border-edge bg-card px-3.5 py-1.5 text-xs font-medium text-ink-muted hover:text-ink disabled:opacity-60"
        >
          {locating ? "Aranıyor..." : "Konumum"}
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-status-danger/40 bg-status-danger/10 px-3.5 py-2.5 text-sm text-status-danger"
        >
          {error}
        </p>
      ) : null}

      {tasks.length === 0 ? (
        <p className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-ink-muted">
          Konumlu aktif görev yok.
        </p>
      ) : (
        <>
          <TaskMap tasks={tasks} userPosition={position} />

          <section>
            <h2 className="text-sm font-semibold text-ink">
              {position ? "Yakınındaki görevler" : "Konumlu görevler"}
            </h2>

            <ul className="mt-3 flex flex-col gap-2.5">
              {nearby.map(({ task, distance }) => (
                <li key={task.id}>
                  <Link
                    href={`/gorevler/${task.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-edge bg-card p-3 transition-colors hover:border-primary/60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {task.title}
                      </span>
                      <span className="block text-[11px] text-ink-muted">
                        {task.categoryName ?? "Görev"} · +{task.xp} XP • +
                        {task.coin} Coin
                      </span>
                    </span>
                    {distance !== null ? (
                      <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-muted">
                        {formatDistance(distance)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
