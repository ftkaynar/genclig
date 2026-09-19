"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ArtPicker } from "./art-picker";
import { IconPicker } from "./icon-picker";
import { QuizEditor, type EditorQuestion } from "./quiz-editor";
import { createClient } from "@/lib/supabase/client";
import {
  saveQuizQuestionsAction,
  saveTaskAction,
} from "@/lib/panel/task-actions";

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
  dailySubmissionLimit: string;
  minTeamSize: string;
  teamBonusXp: string;
  teamBonusCoin: string;
  icon: string;
  /** public/task-art/ anahtarı; boş dize = görsel yok. */
  artKey: string;
  /** Görevi açan kurum; boş = belediye adı, o da yoksa GençLİG (M34a). */
  issuerName: string;
  /** İnsanın okuduğu kısa yer tanımı (M34a). */
  locationLabel: string;
  /*
    Görevin bölgesi (M35c). Keşfet konum filtresi bu iki alanı okuyor;
    boş bırakılan görev hiçbir bölge seçiminde görünmüyor.
  */
  provinceId: string;
  districtId: string;
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
  dailySubmissionLimit: "3",
  minTeamSize: "2",
  teamBonusXp: "0",
  teamBonusCoin: "0",
  icon: "list-checks",
  artKey: "",
  issuerName: "",
  locationLabel: "",
  provinceId: "",
  districtId: "",
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

/*
  YALNIZ İKİ TİP (D38 FAZ K / M36a).

  ÖLÇÜLEN SORUN: bu liste beş tip sunuyordu — Günlük, Haftalık, Aylık
  dahil. Ama `FEED_TASK_TYPES` yalnız "continuous" ve "instant" kabul
  ediyor ve grep'te diğer üç değer kodun BAŞKA HİÇBİR YERİNDE
  geçmiyordu. Personel "Günlük" seçince görev kaydediliyor, `active`
  oluyor ve uygulamada hiç görünmüyordu: ne feed'de, ne haritada, ne
  keşfet sayacında. Keşfet'te "Fatih (3)" yazarken veritabanında
  Fatih'te 4 görev olmasının sebebi buydu.

  Üçünü feed'e eklemek denendi ve elendi: haftalık/aylık ritmi
  hesaplayan kod hiç yazılmamış, `taskCardState` tekrar davranışını
  yalnız `continuous`'a veriyor. Görünür yapmak, ritmi tutulmayan
  görevleri sessizce yanlış çalıştırmak olurdu.

  "Günlük"ün yapması beklenen şeyi `continuous` zaten yapıyor: görev
  günü penceresinde (06:00) tekrarlanabiliyor ve günlük sınır ayrı bir
  sütunda (`daily_submission_limit`).
*/
const TYPES = [
  { value: "continuous", label: "Sürekli" },
  { value: "instant", label: "Anlık" },
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
  initialQuiz = [],
  categories,
  provinces,
  defaultArea,
  scope,
  onSaved,
}: {
  initial: TaskFormValues;
  /*
    Yeni görevde ön dolu bölge (panelde personelin belediyesi).

    AYRI PROP, çünkü birleştirme İSTEMCİDE yapılmak zorunda. Sunucu
    bileşeninde `{...EMPTY_TASK, ...area}` yazmak denendi ve ÖLÇÜMLE
    elendi: EMPTY_TASK bir "use client" modülünden geliyor ve sunucu
    tarafında gerçek nesne değil istemci referansı. Yayılınca bütün
    alanlar kayboluyor, forma yalnız kullanıcının elle doldurduğu
    alanlar kalıyor ve saveTaskAction `input.xp` undefined ile
    çöküyordu (dev log: "Cannot read properties of undefined (reading
    'trim')"). Prop olarak geçilen EMPTY_TASK ise istemcide doğru
    çözülüyor.
  */
  defaultArea?: { provinceId: string; districtId: string };
  /** Düzenlemede mevcut sorular; yeni görevde boş. */
  initialQuiz?: EditorQuestion[];
  categories: { id: number; name: string }[];
  /*
    İller sunucudan hazır geliyor (81 satır, referans önbelleğinden).
    İlçeler İSTEMCİDE yükleniyor: 973 ilçenin tamamını her form
    açılışında göndermek, kullanıcının yalnız birini seçeceği bir liste
    için gereksiz yüktü. Aynı kademeli desen onboarding formunda da var.
  */
  provinces: { id: number; name: string }[];
  scope: "panel" | "admin";
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<TaskFormValues>(() => ({
    ...initial,
    ...(defaultArea ?? {}),
  }));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<EditorQuestion[]>(initialQuiz);
  const [districts, setDistricts] = useState<{ id: number; name: string }[]>(
    [],
  );

  /*
    Seçili ilin ilçeleri.

    Bu effect yalnızca OKUYOR; seçimi temizlemek il seçicisinin kendi
    olay işleyicisinde yapılıyor. Effect gövdesinde senkron setState
    çağırmak `react-hooks/set-state-in-effect` kuralına takılıyor ve
    zaten temizliğin doğal yeri kullanıcı etkileşimi (aynı gerekçe
    onboarding formunda da yazılı).
  */
  useEffect(() => {
    if (!values.provinceId) {
      return;
    }

    let cancelled = false;

    createClient()
      .from("districts")
      .select("id,name")
      .eq("province_id", Number(values.provinceId))
      .order("name")
      .then(({ data }) => {
        if (!cancelled) setDistricts(data ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [values.provinceId]);

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

      /*
        Sorular görev kaydından SONRA yazılıyor: yeni görevde soruların
        bağlanacağı id ancak kayıt dönünce belli oluyor.
      */
      if (values.verification === "quiz") {
        const taskId = result.id ?? values.id;
        if (!taskId) {
          setError("Görev kaydedildi ama sorular bağlanamadı. Sayfayı yenile.");
          return;
        }
        const quizResult = await saveQuizQuestionsAction(taskId, quiz);
        if (quizResult.error) {
          setError(quizResult.error);
          return;
        }
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
          className="mb-3 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2.5 text-sm font-medium text-primary-ink"
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

        <div className="sm:col-span-2">
          <ArtPicker
            value={values.artKey}
            onChange={(key) => set("artKey", key)}
          />
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

        {values.verification === "quiz" ? (
          <div className="sm:col-span-2">
            <QuizEditor questions={quiz} onChange={setQuiz} />
          </div>
        ) : null}

        {/*
          Günlük teslim limiti yalnızca sürekli görevlerde anlamlı:
          diğer tipler zaten dönemsel tekil (günlük görev günde bir kez).
        */}
        {values.type === "continuous" ? (
          <Field label="Günlük teslim limiti">
            <input
              type="number"
              min={1}
              max={50}
              value={values.dailySubmissionLimit}
              onChange={(event) =>
                set("dailySubmissionLimit", event.target.value)
              }
              className={inputClass}
            />
          </Field>
        ) : null}

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

            <Field label="Takım bonusu Token">
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

        <Field label="Token">
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

        <Field label="Görevi açan kurum (isteğe bağlı)">
          <input
            value={values.issuerName}
            onChange={(event) => set("issuerName", event.target.value)}
            placeholder="Yeşil Adımlar Derneği"
            maxLength={60}
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-ink-muted">
            Boş bırakılırsa belediye adı, o da yoksa GençLİG görünür.
          </p>
        </Field>

        <Field label="Konum etiketi (isteğe bağlı)">
          <input
            value={values.locationLabel}
            onChange={(event) => set("locationLabel", event.target.value)}
            placeholder="Gülhane Parkı, Fatih"
            maxLength={80}
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-ink-muted">
            Kullanıcının okuduğu kısa yer tanımı. Koordinat değil.
          </p>
        </Field>

        {/*
          BÖLGE — il + ilçe (D37 FAZ P / M35c).

          ÖLÇÜLEN BORÇ: sütunlar M35c ile geldi ve keşfet konum filtresi
          bunları okuyor, ama formda alan yoktu. Personelin açtığı her
          yeni görev bölgesiz kalıyor ve hiçbir bölge seçiminde
          görünmüyordu.

          PANELDE ÖN DOLU AMA KİLİTLİ DEĞİL. Belediye çoğu zaman kendi
          bölgesi için görev açıyor, o yüzden varsayılan personelin
          belediyesinin il/ilçesi. Kilitlemek denendi ve elendi: (1)
          büyükşehir belediyesi il genelinde iş açıyor ve tek ilçeye
          hapsedilemez, (2) iki ilçenin ortak etkinliği (kıyı temizliği,
          bölgeler arası turnuva) komşu ilçeye yazılmak zorunda.
          Belediye bağlama (municipality_id) zaten sunucuda ve
          değiştirilemiyor; bölge ise görevin NEREDE yapılacağını
          söylüyor, kimin açtığını değil.
        */}
        <Field label="İl (konum filtresi için)">
          <select
            value={values.provinceId}
            onChange={(event) => {
              /*
                İl değişince ilçe TEMİZLENİYOR. Olay işleyicisinde,
                effect'te değil: başka ilin ilçesi seçili kalırsa
                tutarsız bir çift yazılıyordu (aynı kural
                onboarding-form.tsx'te).
              */
              set("provinceId", event.target.value);
              set("districtId", "");
            }}
            className={inputClass}
          >
            <option value="">Bölgesiz</option>
            {provinces.map((province) => (
              <option key={province.id} value={String(province.id)}>
                {province.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-ink-muted">
            Boş bırakılan görev Keşfet&apos;teki bölge filtresinde
            görünmez.
          </p>
        </Field>

        <Field label="İlçe">
          <select
            value={values.districtId}
            onChange={(event) => set("districtId", event.target.value)}
            disabled={!values.provinceId}
            className={inputClass}
          >
            <option value="">
              {values.provinceId ? "İlçe seç" : "Önce il seç"}
            </option>
            {districts.map((district) => (
              <option key={district.id} value={String(district.id)}>
                {district.name}
              </option>
            ))}
          </select>
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
  "w-full rounded-xl border border-edge bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted";

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
