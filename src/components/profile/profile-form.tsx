"use client";

import { useActionState, useEffect, useState } from "react";

import {
  updateProfileAction,
  type ProfileActionState,
} from "@/lib/profile/actions";
import { FormAlert, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/client";

const INITIAL: ProfileActionState = {};

type Option = { id: number; name: string };

/**
 * Ayarlar formu. Kademeli il/ilçe/mahalle seçimi onboarding ile aynı desende:
 * referans listeleri tarayıcıdan okunuyor (RLS'te anon'a dahi açık), yazma
 * sunucuda.
 */
export function ProfileForm({
  provinces,
  initial,
}: {
  provinces: Option[];
  initial: {
    username: string;
    displayName: string;
    provinceId: string;
    districtId: string;
    neighborhoodId: string;
  };
}) {
  const [state, formAction] = useActionState(updateProfileAction, INITIAL);

  const [provinceId, setProvinceId] = useState(initial.provinceId);
  const [districtId, setDistrictId] = useState(initial.districtId);
  const [neighborhoodId, setNeighborhoodId] = useState(initial.neighborhoodId);

  const [districts, setDistricts] = useState<Option[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Option[]>([]);

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

  useEffect(() => {
    if (!districtId) return;
    let cancelled = false;

    createClient()
      .from("neighborhoods")
      .select("id,name")
      .eq("district_id", Number(districtId))
      .order("name")
      .then(({ data }) => {
        if (!cancelled) setNeighborhoods(data ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [districtId]);

  const hasNeighborhoodData = neighborhoods.length > 0;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <FormAlert>{state.error}</FormAlert> : null}
      {state.notice ? <FormAlert kind="info">{state.notice}</FormAlert> : null}

      <TextField
        label="Kullanıcı adı"
        name="username"
        defaultValue={initial.username}
        placeholder="ornek_kullanici"
        hint="3-20 karakter; küçük harf, rakam ve alt çizgi. Sıralamada bu ad görünür."
      />

      <TextField
        label="Görünen ad"
        name="displayName"
        required={false}
        defaultValue={initial.displayName}
        placeholder="Adın"
      />

      <SelectField
        label="İl"
        name="provinceId"
        value={provinceId}
        placeholder="İl seç"
        options={provinces}
        onChange={(value) => {
          setProvinceId(value);
          setDistrictId("");
          setNeighborhoodId("");
          setDistricts([]);
          setNeighborhoods([]);
        }}
      />

      <SelectField
        label="İlçe"
        name="districtId"
        value={districtId}
        placeholder={provinceId ? "İlçe seç" : "Önce il seç"}
        options={districts}
        disabled={!provinceId}
        onChange={(value) => {
          setDistrictId(value);
          setNeighborhoodId("");
          setNeighborhoods([]);
        }}
      />

      <SelectField
        label="Mahalle"
        name="neighborhoodId"
        value={neighborhoodId}
        placeholder={
          !districtId
            ? "Önce ilçe seç"
            : hasNeighborhoodData
              ? "Mahalle seç"
              : "Mahallem listede yok"
        }
        options={neighborhoods}
        disabled={!districtId || !hasNeighborhoodData}
        onChange={setNeighborhoodId}
      />

      <SubmitButton pendingLabel="Kaydediliyor...">Kaydet</SubmitButton>
    </form>
  );
}
