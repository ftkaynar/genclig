"use client";

import { useActionState, useEffect, useState } from "react";

import {
  completeOnboardingAction,
  type ActionState,
} from "@/lib/auth/actions";
import {
  FormAlert,
  SelectField,
  SubmitButton,
  TextField,
} from "@/components/ui/form";
import { createClient } from "@/lib/supabase/client";

const INITIAL: ActionState = {};

type Option = { id: number; name: string };

/*
  İlçe ve mahalle listeleri tarayıcıdan çekiliyor.

  Neden client: seçim kademeli (il -> ilçe -> mahalle) ve her adımda sayfayı
  sunucuya geri göndermek formu sıfırlıyordu. Bu veri herkese açık referans
  verisi; RLS'te provinces/districts/neighborhoods için select politikası anon'a
  dahi açık, yani burada gizli bir şey okunmuyor.

  Profilin yazılması ise client'ta DEĞİL, completeOnboardingAction içinde
  sunucuda yapılıyor.
*/
export function OnboardingForm({ provinces }: { provinces: Option[] }) {
  const [state, formAction] = useActionState(completeOnboardingAction, INITIAL);

  const [provinceId, setProvinceId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");

  const [districts, setDistricts] = useState<Option[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Option[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  /*
    Listeleri temizleme işi effect'te değil onChange'de yapılıyor.
    Neden: effect gövdesinde senkron setState çağırmak cascading render
    üretiyor ve lint bunu hata olarak işaretliyor. Seçim zaten kullanıcı
    etkileşimiyle değiştiği için temizliğin doğal yeri olay işleyicisi.
  */
  useEffect(() => {
    if (!provinceId) return;

    let cancelled = false;

    createClient()
      .from("districts")
      .select("id,name")
      .eq("province_id", Number(provinceId))
      .order("name")
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoadFailed(Boolean(error));
        setDistricts(data ?? []);
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
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoadFailed(Boolean(error));
        setNeighborhoods(data ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [districtId]);

  const hasNeighborhoodData = neighborhoods.length > 0;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <FormAlert>{state.error}</FormAlert> : null}
      {loadFailed ? (
        <FormAlert>Liste yüklenemedi. Bağlantını kontrol edip tekrar dene.</FormAlert>
      ) : null}

      <TextField
        label="Kullanıcı adı"
        name="username"
        autoComplete="username"
        placeholder="ornek_kullanici"
        hint="3-20 karakter; küçük harf, rakam ve alt çizgi."
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
        hint={
          districtId && !hasNeighborhoodData
            ? "Bu ilçe için mahalle listesi henüz yok. Bu alanı boş bırakıp devam edebilirsin."
            : "Mahallen listede yoksa boş bırakabilirsin."
        }
      />

      <SubmitButton pendingLabel="Kaydediliyor...">Devam et</SubmitButton>
    </form>
  );
}
