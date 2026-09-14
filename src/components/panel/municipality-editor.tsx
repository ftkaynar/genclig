"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { upsertMunicipalityAction } from "@/lib/panel/admin-actions";
import { createClient } from "@/lib/supabase/client";

/**
 * Yeni belediye ekler.
 *
 * İlçe listesi il seçildikten sonra tarayıcıdan çekiliyor; 973 ilçeyi
 * baştan yüklemek sayfayı gereksiz ağırlaştırıyordu.
 */
export function MunicipalityEditor({
  provinces,
}: {
  provinces: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [level, setLevel] = useState("district");
  const [provinceId, setProvinceId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [districts, setDistricts] = useState<{ id: number; name: string }[]>([]);

  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!provinceId) return;
    let cancelled = false;

    createClient()
      .from("districts")
      .select("id,name")
      .eq("province_id", Number(provinceId))
      .order("name")
      .then(({ data }) => {
        if (!cancelled) setDistricts(data ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [provinceId]);

  async function save() {
    setMessage(null);

    if (!provinceId) {
      setMessage("İl seçmelisin.");
      return;
    }

    setPending(true);
    try {
      const result = await upsertMunicipalityAction({
        name,
        slug,
        level,
        provinceId: Number(provinceId),
        districtId: districtId ? Number(districtId) : null,
        status: "active",
      });

      setMessage(result.error ?? result.notice ?? null);

      if (!result.error) {
        setName("");
        setSlug("");
        setDistrictId("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-cta px-4 py-2 text-sm font-semibold text-white"
      >
        Yeni belediye
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-edge bg-card p-4">
      <h3 className="text-sm font-semibold text-ink">Yeni belediye</h3>

      {message ? (
        <p className="mt-2 text-xs text-ink-muted">{message}</p>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink">Ad</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Kadıköy Belediyesi"
            className="w-full rounded-xl border border-edge bg-surface px-3 py-2 text-sm text-ink"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink">
            Kısa ad (slug)
          </span>
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="kadikoy"
            className="w-full rounded-xl border border-edge bg-surface px-3 py-2 text-sm text-ink"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink">Tür</span>
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            className="w-full rounded-xl border border-edge bg-surface px-3 py-2 text-sm text-ink"
          >
            <option value="metropolitan">Büyükşehir</option>
            <option value="district">İlçe</option>
            <option value="town">Belde</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink">İl</span>
          <select
            value={provinceId}
            onChange={(event) => {
              setProvinceId(event.target.value);
              setDistrictId("");
              setDistricts([]);
            }}
            className="w-full rounded-xl border border-edge bg-surface px-3 py-2 text-sm text-ink"
          >
            <option value="">İl seç</option>
            {provinces.map((province) => (
              <option key={province.id} value={String(province.id)}>
                {province.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink">
            İlçe (büyükşehirde boş bırakılır)
          </span>
          <select
            value={districtId}
            onChange={(event) => setDistrictId(event.target.value)}
            disabled={!provinceId}
            className="w-full rounded-xl border border-edge bg-surface px-3 py-2 text-sm text-ink disabled:opacity-50"
          >
            <option value="">İlçe seç</option>
            {districts.map((district) => (
              <option key={district.id} value={String(district.id)}>
                {district.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-full bg-cta px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Kaydediliyor..." : "Kaydet"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-edge px-4 py-2 text-sm font-medium text-ink-muted"
        >
          Kapat
        </button>
      </div>
    </div>
  );
}
