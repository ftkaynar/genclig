"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

import { MapSkeleton } from "./map-skeleton";
import { HScroll } from "@/components/ui/h-scroll";
import { TaskTile } from "@/components/tasks/task-tile";
import { Icon } from "@/components/ui/icon";
import type { DiscoverTask } from "@/lib/discover/queries";
import type { SubmissionSummary, TaskRow } from "@/lib/tasks/queries";

/*
  Harita yalnızca tarayıcıda yükleniyor (ssr: false).

  Leaflet doğrudan window ve document'e erişiyor; sunucuda render edilmeye
  çalışıldığında derleme kırılıyor. dynamic import bunun standart çözümü.
*/
const TaskMap = dynamic(
  () => import("./task-map").then((mod) => mod.TaskMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

export type DistrictStats = {
  district_name: string;
  active_tasks: number;
  weekly_completed: number;
  channel_id: string | null;
};

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

/** Şerit başlığı: ikon + başlık + "tümünü gör" derin linki. */
function StripHeader({
  icon,
  title,
  href,
}: {
  icon: string;
  title: string;
  href?: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Icon name={icon} className="h-4 w-4 text-primary" />
        {title}
      </h2>
      {href ? (
        <Link
          href={href}
          className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
        >
          Tümünü gör
          <Icon name="chevron-right" className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

/** Yatay kaydırmalı kutucuk şeridi. */
function Strip({ children }: { children: React.ReactNode }) {
  return (
    <HScroll as="ul">
      {children}
    </HScroll>
  );
}

export function DiscoverView({
  tasks,
  mapTasks,
  submissions,
  categories,
  hasLocation,
}: {
  /** Tüm aktif feed görevleri (şeritler bunlardan üretiliyor). */
  tasks: TaskRow[];
  /** Haritanın hafif veri şekli. */
  mapTasks: DiscoverTask[];
  submissions: Record<string, SubmissionSummary>;
  categories: { slug: string; name: string }[];
  hasLocation: boolean;
}) {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("");

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

  // Kategori filtresi haritayı ve tüm şeritleri birlikte süzüyor.
  const visible = useMemo(
    () =>
      activeCategory
        ? tasks.filter(
            (task) => task.task_categories?.slug === activeCategory,
          )
        : tasks,
    [tasks, activeCategory],
  );

  const visibleMapTasks = useMemo(
    () =>
      activeCategory
        ? mapTasks.filter((task) => task.categorySlug === activeCategory)
        : mapTasks,
    [mapTasks, activeCategory],
  );

  /*
    Yakındakiler yalnızca konum alındığında hesaplanıyor ve konumu olan
    görevlerle sınırlı. Konum yokken mesafe rozeti uydurmak yerine şerit
    hiç gösterilmiyor.
  */
  const nearby = useMemo(() => {
    if (!position) return [];
    return visible
      .filter((task) => task.lat !== null && task.lng !== null)
      .map((task) => ({
        task,
        distance: distanceMeters(
          position[0],
          position[1],
          task.lat as number,
          task.lng as number,
        ),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10);
  }, [visible, position]);

  const upcoming = useMemo(
    () =>
      visible
        .filter((task) => task.timeState === "upcoming")
        .sort(
          (a, b) =>
            new Date(a.starts_at as string).getTime() -
            new Date(b.starts_at as string).getTime(),
        ),
    [visible],
  );

  /*
    Kategori şeritleri: yalnızca görevi OLAN kategoriler görünüyor.
    Boş bir "Spor" başlığı kullanıcıya uygulamanın eksik olduğunu
    düşündürüyordu.
  */
  const byCategory = useMemo(() => {
    const groups = new Map<string, { name: string; rows: TaskRow[] }>();
    for (const task of visible) {
      const slug = task.task_categories?.slug;
      const name = task.task_categories?.name;
      if (!slug || !name) continue;
      if (!groups.has(slug)) groups.set(slug, { name, rows: [] });
      groups.get(slug)!.rows.push(task);
    }
    return [...groups.entries()];
  }, [visible]);

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------- harita */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">
            Konumlu görevler haritada işaretli.
          </p>
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className="press-soft inline-flex min-h-[40px] shrink-0 items-center rounded-full border border-indigo/70 bg-card px-3.5 text-[13px] font-semibold text-white disabled:opacity-55"
          >
            {locating ? "Aranıyor..." : "Konumum"}
          </button>
        </div>

        {/* Kategori filtre çipleri */}
        <nav aria-label="Kategori filtresi" className="mb-2">
          <HScroll className="mt-2" ariaLabel="Kategoriler">
            <span className="shrink-0">
              <button
                type="button"
                onClick={() => setActiveCategory("")}
                aria-pressed={activeCategory === ""}
                className={
                  activeCategory === ""
                    ? "brand-gradient inline-flex min-h-[40px] items-center rounded-full px-3.5 text-[13px] font-semibold text-white"
                    : "press-soft inline-flex min-h-[40px] items-center rounded-full border border-edge bg-card px-3.5 text-[13px] font-medium text-ink-muted hover:text-ink"
                }
              >
                Tümü
              </button>
            </span>
            {categories.map((category) => (
              <span key={category.slug} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveCategory(category.slug)}
                  aria-pressed={activeCategory === category.slug}
                  className={
                    activeCategory === category.slug
                      ? "brand-gradient inline-flex min-h-[40px] items-center rounded-full px-3.5 text-[13px] font-semibold text-white"
                      : "press-soft inline-flex min-h-[40px] items-center rounded-full border border-edge bg-card px-3.5 text-[13px] font-medium text-ink-muted hover:text-ink"
                  }
                >
                  {category.name}
                </button>
              </span>
            ))}
          </HScroll>
        </nav>

        {error ? (
          <p
            role="alert"
            className="mb-2 rounded-xl border border-status-danger/40 bg-status-danger/10 px-3.5 py-2 text-xs text-status-danger"
          >
            {error}
          </p>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-edge">
          <TaskMap tasks={visibleMapTasks} userPosition={position} />
        </div>
      </section>

      {/* Konum ayarlı değilse öneri kartı */}
      {!hasLocation ? (
        <Link
          href="/ayarlar"
          className="flex items-center gap-3 rounded-2xl border border-primary/50 bg-card p-3.5"
        >
          <span className="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white">
            <Icon name="map-pin" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">
              Konumunu ayarla
            </span>
            <span className="block text-[11px] text-ink-muted">
              İlçeni seçince sana daha yakın görevler önerilir.
            </span>
          </span>
          <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-ink-muted" />
        </Link>
      ) : null}

      {/* --------------------------------------------------- yakındakiler */}
      {nearby.length > 0 ? (
        <section>
          <StripHeader icon="compass" title="Yakınındaki görevler" />
          <Strip>
            {nearby.map(({ task, distance }, i) => (
              <TaskTile
                key={task.id}
                task={task}
                submission={submissions[task.id]}
                index={i}
                distanceLabel={formatDistance(distance)}
                small
              />
            ))}
          </Strip>
        </section>
      ) : null}

      {/* ------------------------------------------------ yaklaşan etkinlik */}
      {upcoming.length > 0 ? (
        <section>
          <StripHeader
            icon="calendar-clock"
            title="Yaklaşan etkinlikler"
            href="/gorevler?tip=instant"
          />
          <Strip>
            {upcoming.map((task, i) => (
              <TaskTile
                key={task.id}
                task={task}
                submission={submissions[task.id]}
                index={i}
                small
              />
            ))}
          </Strip>
        </section>
      ) : null}

      {/* --------------------------------------------------- kategoriler */}
      {byCategory.map(([slug, group]) => (
        <section key={slug}>
          {/*
            Kategori şeridinde "tümünü gör" YOK: /gorevler'de kategori
            filtresi bulunmuyor ve süzmeyen bir bağlantı kullanıcıya
            yalan söylerdi. Kategori filtresi eklenirse buraya derin
            link konabilir.
          */}
          <StripHeader icon="list-checks" title={group.name} />
          <Strip>
            {group.rows.map((task, i) => (
              <TaskTile
                key={task.id}
                task={task}
                submission={submissions[task.id]}
                index={i}
                small
              />
            ))}
          </Strip>
        </section>
      ))}

      {/*
        İLÇE İSTATİSTİK KARTI KALDIRILDI (D32 FAZ KE).

        Kart kullanıcıya bu senin alanın diyordu ve topluluk bağlantısı
        da ilçeye işaret ediyordu. Platform Türkiye geneli; kullanıcıyı
        kendi ilçesine çerçevelemek amaca aykırıydı. Topluluk artık il
        seçicili (M30), bu kartın da işlevi kalmadı.
      */}

      {tasks.length === 0 ? (
        <p className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-ink-muted">
          Şu an keşfedilecek görev yok.
        </p>
      ) : null}
    </div>
  );
}
