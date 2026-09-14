"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { IconPicker } from "./icon-picker";
import { saveTaskAction } from "@/lib/panel/task-actions";

export type TaskFormValues = {
  id?: string;
  title: string;
  description: string;
  instructions: string;
  type: string;
  categoryId: string;
  verification: string;
  difficulty: string;
  taskScope: string;
  minTeamSize: string;
  teamBonusXp: string;
  teamBonusCoin: string;
  icon: string;
  xp: string;
  coin: string;
  startsAt: string;
  endsAt: string;
  lat: string;
  lng: string;
  radiusM: string;
  capacity: string;
  imageUrl: string;
  status: string;
};

export const EMPTY_TASK: TaskFormValues = {
  title: "",
  description: "",
  instructions: "",
  type: "continuous",
  categoryId: "",
  verification: "photo",
  difficulty: "easy",
  taskScope: "individual",
  minTeamSize: "2",
  teamBonusXp: "0",
  teamBonusCoin: "0",
  icon: "list-checks",
  xp: "50",
  coin: "50",
  startsAt: "",
  endsAt: "",
  lat: "",
  lng: "",
  radiusM: "150",
  capacity: "",
  imageUrl: "",
  status: "draft",
};

const TYPES = [
  { value: "continuous", label: "Sürekli" },
  { value: "instant", label: "Anlık" },
  { value: "daily", label: "Günlük" },
  { value: "weekly", label: "Haftalık" },
  { value: "monthly", label: "Aylık" },
];

const SCOPES = [
  { value: "individual", label: "Bireysel" },
  { value: "team", label: "Takım" },
];

const VERIFICATIONS = [
  { value: "photo", label: "Fotoğraf" },
  { value: "gps", label: "Konum" },
  { value: "photo_gps", label: "Fotoğraf + Konum" },
  { value: "manual", label: "Elle onay" },
];

const DIFFICULTIES = [
  { value: "easy", label: "Kolay" },
  { value: "medium", label: "Orta" },
  { value: "hard", label: "Zor" },
];

const STATUSES = [
  { value: "draft", label: "Taslak" },
  { value: "active", label: "Yayında" },
  { value: "paused", label: "Duraklatıldı" },
  { value: "archived", label: "Arşiv" },
];

/**
 * Görev oluşturma ve düzenleme formu.
 *
 * Panel ve admin aynı bileşeni kullanıyor; tek fark municipality bağlama:
 * panelde personelin belediyesi sunucuda otomatik yazılıyor, adminde null
 * (global görev) kalıyor. Formu ikiye bölmek iki yerde ayrışan doğrulama
 * demekti.
 */
export function TaskForm({
  initial,
  categories,
  scope,
  onSaved,
}: {
  initial: TaskFormValues;
  categories: { id: number; name: string }[];
  scope: "panel" | "admin";
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<TaskFormValues>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const needsLocation =
    values.verification === "gps" || values.verification === "photo_gps";
  const needsEnd = values.type === "instant";

  function set<K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const result = await saveTaskAction({ ...values, scope });
      if (result.error) {
        setError(result.error);
        return;
      }
      setNotice(result.notice ?? "Kaydedildi.");
      router.refresh();
      onSaved?.();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-edge bg-card p-4">
      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-status-danger/40 bg-status-danger/10 px-3.5 py-2.5 text-sm text-status-danger"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="mb-3 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2.5 text-sm font-medium text-primary"
        >
          {notice}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Başlık" className="sm:col-span-2">
          <input
            value={values.title}
            onChange={(event) => set("title", event.target.value)}
            className={inputClass}
            placeholder="Mahallendeki bir sorunu fotoğrafla"
          />
        </Field>

        <Field label="Açıklama" className="sm:col-span-2">
          <textarea
            rows={3}
            value={values.description}
            onChange={(event) => set("description", event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Nasıl yapılır (isteğe bağlı)" className="sm:col-span-2">
          <textarea
            rows={2}
            value={values.instructions}
            onChange={(event) => set("instructions", event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Tür">
          <select
            value={values.type}
            onChange={(event) => set("type", event.target.value)}
            className={inputClass}
          >
            {TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Kategori">
          <select
            value={values.categoryId}
            onChange={(event) => set("categoryId", event.target.value)}
            className={inputClass}
          >
            <option value="">Kategori seç</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="sm:col-span-2">
          <IconPicker value={values.icon} onChange={(name) => set("icon", name)} />
        </div>

        <Field label="Doğrulama">
          <select
            value={values.verification}
            onChange={(event) => set("verification", event.target.value)}
            className={inputClass}
          >
            {VERIFICATIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Zorluk">
          <select
            value={values.difficulty}
            onChange={(event) => set("difficulty", event.target.value)}
            className={inputClass}
          >
            {DIFFICULTIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Kapsam">
          {/*
            Bireysel/Takım anahtarı. Takım seçildiğinde eşik ve bonus
            alanları açılıyor; bireysel görevde bunlar anlamsız olduğu için
            hiç gösterilmiyor — boş bırakılması gereken alanlar formu
            gürültülü yapıyordu.
          */}
          <div className="flex rounded-lg border border-edge p-1">
            {SCOPES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => set("taskScope", item.value)}
                aria-pressed={values.taskScope === item.value}
                className={
                  values.taskScope === item.value
                    ? "flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                    : "flex-1 rounded-md px-3 py-1.5 text-xs font-medium text-ink-muted"
                }
              >
                {item.label}
              </button>
            ))}
          </div>
        </Field>

        {values.taskScope === "team" ? (
          <>
            <Field label="Eşik (kaç kişi)">
              <input
                type="number"
                min={2}
                max={10}
                value={values.minTeamSize}
                onChange={(event) => set("minTeamSize", event.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Takım bonusu XP">
              <input
                type="number"
                min={0}
                value={values.teamBonusXp}
                onChange={(event) => set("teamBonusXp", event.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Takım bonusu Coin">
              <input
                type="number"
                min={0}
                value={values.teamBonusCoin}
                onChange={(event) => set("teamBonusCoin", event.target.value)}
                className={inputClass}
              />
            </Field>
          </>
        ) : null}

        <Field label="XP">
          <input
            type="number"
            value={values.xp}
            onChange={(event) => set("xp", event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Coin">
          <input
            type="number"
            value={values.coin}
            onChange={(event) => set("coin", event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Başlangıç (isteğe bağlı)">
          <input
            type="datetime-local"
            value={values.startsAt}
            onChange={(event) => set("startsAt", event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field
          label={needsEnd ? "Bitiş (anlık görevde zorunlu)" : "Bitiş (isteğe bağlı)"}
        >
          <input
            type="datetime-local"
            value={values.endsAt}
            onChange={(event) => set("endsAt", event.target.value)}
            className={inputClass}
          />
        </Field>

        {needsLocation ? (
          <>
            <Field label="Enlem (lat)">
              <input
                value={values.lat}
                onChange={(event) => set("lat", event.target.value)}
                placeholder="41.01340"
                className={inputClass}
              />
            </Field>

            <Field label="Boylam (lng)">
              <input
                value={values.lng}
                onChange={(event) => set("lng", event.target.value)}
                placeholder="28.98120"
                className={inputClass}
              />
            </Field>

            <Field label="Yarıçap (metre)">
              <input
                type="number"
                value={values.radiusM}
                onChange={(event) => set("radiusM", event.target.value)}
                className={inputClass}
              />
            </Field>
          </>
        ) : null}

        <Field label="Kontenjan (boş = sınırsız)">
          <input
            type="number"
            value={values.capacity}
            onChange={(event) => set("capacity", event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Görsel adresi (isteğe bağlı)" className="sm:col-span-2">
          <input
            value={values.imageUrl}
            onChange={(event) => set("imageUrl", event.target.value)}
            placeholder="https://..."
            className={inputClass}
          />
        </Field>

        <Field label="Durum">
          <select
            value={values.status}
            onChange={(event) => set("status", event.target.value)}
            className={inputClass}
          >
            {STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="mt-4 w-full rounded-full btn-chunky bg-cta px-6 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {pending ? "Kaydediliyor..." : values.id ? "Güncelle" : "Görevi oluştur"}
      </button>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-edge bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70";

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
