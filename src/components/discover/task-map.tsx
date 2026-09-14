"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import type { DiscoverTask } from "@/lib/discover/queries";

/*
  Harita.

  Leaflet'in varsayılan işaretçi ikonları bundler altında bozuk yol üretiyor
  (paket içindeki görselleri CSS'ten göreli çözüyor). Bu yüzden işaretçiler
  divIcon ile, kategori rengini taşıyan küçük bir daire olarak çiziliyor;
  hem sorun ortadan kalkıyor hem marka renkleri korunuyor.
*/

/** Kategori slug'ına göre pin rengi; D04 token değerleri. */
const CATEGORY_COLOR: Record<string, string> = {
  environment: "#22C55E",
  social: "#7C3AED",
  sports: "#EC4899",
  culture: "#6366F1",
  education: "#F59E0B",
  civic: "#22D3EE",
};

function pinIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

const USER_ICON = L.divIcon({
  className: "",
  html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#22D3EE;border:3px solid #0B1220"></span>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

/** Kullanıcı konumu geldiğinde haritayı oraya taşır. */
function RecenterOnUser({ position }: { position: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.setView(position, 14);
    }
  }, [map, position]);

  return null;
}

export function TaskMap({
  tasks,
  userPosition,
}: {
  tasks: DiscoverTask[];
  userPosition: [number, number] | null;
}) {
  // İlk görünüm: kullanıcı konumu yoksa görevlerin ortalaması, o da yoksa
  // İstanbul. Boş haritayla açılmak kullanıcıyı kaybediyordu.
  const center = useMemo<[number, number]>(() => {
    if (userPosition) return userPosition;
    if (tasks.length > 0) {
      const lat = tasks.reduce((sum, t) => sum + t.lat, 0) / tasks.length;
      const lng = tasks.reduce((sum, t) => sum + t.lng, 0) / tasks.length;
      return [lat, lng];
    }
    return [41.0082, 28.9784];
  }, [tasks, userPosition]);

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom
      className="h-72 w-full rounded-2xl border border-edge"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <RecenterOnUser position={userPosition} />

      {userPosition ? (
        <Marker position={userPosition} icon={USER_ICON}>
          <Popup>Buradasın</Popup>
        </Marker>
      ) : null}

      {tasks.map((task) => (
        <Marker
          key={task.id}
          position={[task.lat, task.lng]}
          icon={pinIcon(CATEGORY_COLOR[task.categorySlug ?? ""] ?? "#6366F1")}
        >
          <Popup>
            <span className="block text-sm font-semibold">{task.title}</span>
            <span className="block text-xs">
              +{task.xp} XP • +{task.coin} Coin
            </span>
            <a
              href={`/gorevler/${task.id}`}
              className="mt-1 block text-xs font-semibold underline"
            >
              Göreve git
            </a>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

