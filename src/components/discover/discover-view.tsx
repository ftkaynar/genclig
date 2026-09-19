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

  /*
    KONUM AKIŞI (D36 FAZ D1'de yeniden yazıldı).

    ÖLÇÜLEN DURUM: başarı yolu zaten çalışıyordu — izin verilmiş bir
    tarayıcıda "Konumum" kullanıcı noktasını koyuyor, haritayı 14
    yakınlaştırmaya taşıyor ve "Yakınındaki görevler" şeridini gerçek
    mesafelerle (529 m, 2.7 km) açıyor. Yani hata tek bir kırık satır
    değildi; düğme ÜÇ ayrı sebeple "çalışmıyor" gibi görünüyordu:

    1. TEK DENEME, YÜKSEK HASSASİYET. `enableHighAccuracy: true` +
       `maximumAge: 0` + 15sn: telefonda kapalı mekânda GPS kilidi çoğu
       zaman bu süreye sığmıyor ve TIMEOUT dönüyor. Kullanıcı "Konumun
       alınamadı" görüp bir daha denemiyordu. Artık iki aşama var:
       önce hassas (8sn), olmazsa ağ tabanlı (20sn, 1 dakikalık önbellek
       kabul). Şehir ölçeğinde görev listelemek için baz istasyonu
       hassasiyeti fazlasıyla yeterli.

    2. İZİN REDDİNDE YÖNLENDİRME YOK. Eski metin "Konum izni verilmedi.
       Görevleri haritadan gezebilirsin." diyordu — doğru ama çıkışsız.
       Kullanıcı izni nereden geri açacağını bilmiyor.

    3. ZATEN REDDEDİLMİŞSE 8 SANİYE BEKLEME. Permissions API varsa
       önceden sorulup anında yönlendirme veriliyor; tarayıcı sessizce
       reddedip zaman aşımına düşmüyor.

    Güvenli bağlam kontrolü de eklendi: geolocation yalnız https (ve
    localhost) altında çalışıyor, aksi halde çağrı sessizce başarısız
    oluyordu.
  */
  const DENIED_HELP =
    "Konum izni kapalı. Tarayıcı adres çubuğundaki kilit simgesinden " +
    "(telefonda Ayarlar › Site ayarları › Konum) izni açıp tekrar dene.";

  function apply(result: GeolocationPosition) {
    setPosition([result.coords.latitude, result.coords.longitude]);
    setLocating(false);
    setError(null);
  }

  function fail(positionError: GeolocationPositionError) {
    setLocating(false);

    if (positionError.code === positionError.PERMISSION_DENIED) {
      setError(DENIED_HELP);
      return;
    }
    if (positionError.code === positionError.TIMEOUT) {
      setError(
        "Konum zamanında gelmedi. Açık alana çıkıp ya da Wi-Fi açıkken " +
          "tekrar dene.",
      );
      return;
    }
    setError(
      "Konum şu an alınamıyor. Cihazın konum servisi kapalı olabilir.",
    );
  }

  async function locate() {
    setError(null);

    if (!("geolocation" in navigator)) {
      setError("Bu cihaz konum bilgisi vermiyor.");
      return;
    }

    /*
      Güvenli bağlam şart. localhost istisna olduğu için geliştirmede
      sorun çıkmıyor; canlıda site https, yani bu dal yalnız beklenmeyen
      bir kurulumda tetikleniyor.
    */
    if (!window.isSecureContext) {
      setError("Konum yalnızca güvenli bağlantıda (https) alınabiliyor.");
      return;
    }

    // Zaten reddedilmişse beklemeden yönlendir.
    try {
      const status = await navigator.permissions.query({
        name: "geolocation" as PermissionName,
      });
      if (status.state === "denied") {
        setError(DENIED_HELP);
        return;
      }
    } catch {
      // Permissions API yok (eski Safari): normal akışa devam.
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(apply, (firstError) => {
      // İzin reddi tekrar denemeye değmez; ikinci deneme de reddedilir.
      if (firstError.code === firstError.PERMISSION_DENIED) {
        fail(firstError);
        return;
      }

      // İkinci aşama: ağ tabanlı, önbellekli, uzun süreli.
      navigator.geolocation.getCurrentPosition(apply, fail, {
        enableHighAccuracy: false,
        timeout: 20_000,
        maximumAge: 60_000,
      });
    }, { enableHighAccuracy: true, timeout: 8_000, maximumAge: 0 });
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

    MESAFE SINIRI 40 km (D36 FAZ D1). Önceden sınır YOKTU: en yakın on
    görev ne kadar uzakta olursa olsun "Yakınındaki görevler" başlığı
    altına giriyordu. Ankara'daki kullanıcı İstanbul görevlerini
    "412.3 km" etiketiyle yakın diye görüyordu — başlık yalan
    söylüyordu ve düğmenin çalıştığına dair güveni de bu bozuyordu.

    40 km: bir büyükşehrin ucundan ucuna makul üst sınır. 10 km denendi
    ve elendi — görev havuzu henüz seyrek olduğu için şerit çoğu
    kullanıcıda hiç açılmıyordu.
  */
  const NEARBY_LIMIT_M = 40_000;

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
      .filter((row) => row.distance <= NEARBY_LIMIT_M)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10);
  }, [visible, position]);

  /*
    Konum alındı ama 40 km içinde konumlu görev yok: sebebi söylemek
    gerekiyor. Şeridi hiç göstermemek, kullanıcıya "Konumum çalışmadı"
    dedirtiyordu — oysa konum geldi, yakında görev yok.
  */
  const locatedButEmpty = position !== null && nearby.length === 0;

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
      {locatedButEmpty ? (
        <p className="flex items-center gap-2.5 rounded-2xl border border-cyan/40 bg-cyan/10 px-3.5 py-2.5 text-xs text-ink">
          <Icon name="compass" className="h-4 w-4 shrink-0 text-cyan" />
          Konumun bulundu ama 40 km içinde konumlu görev yok. Haritayı
          gezerek başka bölgelere bakabilirsin.
        </p>
      ) : null}

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
            Derin link BAĞLANDI (D35 FAZ G).

            Önceki sürümde "tümünü gör" yoktu çünkü /gorevler'de kategori
            filtresi bulunmuyordu ve süzmeyen bir bağlantı kullanıcıya
            yalan söylerdi. Filtre bu dilimde eklendi; şerit artık
            gerçekten süzülmüş listeye gidiyor.
          */}
          <StripHeader
            icon="list-checks"
            title={group.name}
            href={`/gorevler?kategori=${slug}`}
          />
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
