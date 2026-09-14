"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import {
  CATEGORY_PIN,
  CATEGORY_PIN_FALLBACK,
  pinMarkup,
} from "./pin-icons";
import type { DiscoverTask } from "@/lib/discover/queries";

/*
  Harita.

  Leaflet'in varsayılan işaretçi ikonları bundler altında bozuk yol üretiyor
  (paket içindeki görselleri CSS'ten göreli çözüyor). Bu yüzden işaretçiler
  divIcon ile, kategori rengini taşıyan küçük bir daire olarak çiziliyor;
  hem sorun ortadan kalkıyor hem marka renkleri korunuyor.

  v2'de işaretçi düz daireden kategori çipine yükseltildi: renk tek başına
  altı kategoriyi ayırt ettirmiyordu, özellikle renk körlüğünde. Çip artık
  kategorinin ikonunu da taşıyor.
*/

/** Kategori çipi; markup pin-icons.ts'te. */
function pinIcon(slug: string | null) {
  const pin = CATEGORY_PIN[slug ?? ""] ?? CATEGORY_PIN_FALLBACK;
  return L.divIcon({
    className: "",
    html: pinMarkup(pin),
    iconSize: [32, 38],
    // Sivri uç görevin tam konumunu göstersin diye çapa altta.
    iconAnchor: [16, 38],
    popupAnchor: [0, -34],
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
          icon={pinIcon(task.categorySlug)}
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

