import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { PERIODS, SCOPES } from "@/lib/leaderboard/queries";

/*
  Sıralama filtreleri — TEK KART (D32 FAZ SR2, D34 FAZ ST).

  ÖNCEKİ DURUM (D32'de çözüldü): üç ayrı şerit alt alta duruyordu, üçü
  farklı yükseklikte ve farklı görsel dilde; ekranın üçte biri filtreye
  gidiyordu.

  D34 FAZ ST: alan çipleri artık TAKIM modunda da görünüyor.

  ÖNCEKİ DURUM: `{isTeams ? null : ...}` ile gizleniyorlardı, çünkü
  leaderboard_teams yalnız dönem alıyordu. Aynı ekranın iki sekmesi iki
  ayrı derinlikte değerlendiriliyordu — Bireysel dört kapsamda, Takım
  hiçbirinde. M33 ile fonksiyon kapsam da aldı; artık iki mod TAM OLARAK
  aynı filtre bloğunu paylaşıyor.

  Mod ve kapsam iki AYRI parametre (?mod= ve ?kapsam=): tek parametrede
  taşımak, "takimlar" değerinin hem modu hem alanı işgal etmesi demekti
  ve ikinci bilgiye yer kalmıyordu.
*/

const SCOPE_ICON: Record<string, string> = {
  turkiye: "globe",
  il: "map-pin",
  ilce: "compass",
  mahalle: "home",
};

/*
  'takimlar' artık bir KAPSAM değil MOD. SCOPES listesinde hâlâ duruyor
  (eski bağlantılar için sayfa tarafında çözülüyor) ama filtre
  çiplerinde gösterilmiyor — coğrafi olmayan bir değer, coğrafi
  çiplerin arasında yanlış yerde olurdu.
*/
const TEAM_KEY = "takimlar";
const AREA_SCOPES = SCOPES.filter((item) => item.key !== TEAM_KEY);

function href(scope: string, period: string, isTeams: boolean): string {
  const mode = isTeams ? "&mod=takim" : "";
  return `/siralama?kapsam=${scope}&donem=${period}${mode}`;
}

export function ScopeTabs({
  scope,
  period,
  isTeams,
}: {
  scope: string;
  period: string;
  isTeams: boolean;
}) {
  return (
    <div className="px-4 pb-3 pt-3">
      {/*
        Tek filtre kartı: hafif iç gölge kartı zeminden ayırıyor.
        Üç ayrı kutu denendi ve elendi (D32 FAZ SR2) — ekranın üçte
        biri filtreye gidiyordu.
      */}
      <div className="filter-card rounded-2xl border border-edge bg-card p-2">
        {/* ------------------------------------------ 1. Bireysel | Takım */}
        <div
          role="group"
          aria-label="Sıralama modu"
          className="relative flex rounded-xl bg-surface p-1"
        >
          {/* Kayan gösterge: seçili yarıya kayıyor. */}
          <span
            aria-hidden
            className={`brand-gradient absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-lg transition-all duration-300 ease-out ${
              isTeams ? "left-1/2" : "left-1"
            }`}
          />

          {/*
            Mod değişirken KAPSAM ve DÖNEM korunuyor (D34 FAZ ST).

            Önceden takımdan bireysele dönerken Türkiye'ye düşülüyordu,
            çünkü takım modunda saklanacak bir alan seçimi yoktu. Artık
            iki mod da aynı alanı anlıyor; "İlçemdeki bireyler"den
            "ilçemdeki takımlar"a geçmek tek dokunuş.
          */}
          <Link
            href={href(scope, period, false)}
            aria-pressed={!isTeams}
            className={`relative z-10 flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg text-[13px] font-bold transition-colors ${
              isTeams ? "text-ink-muted hover:text-ink" : "text-white"
            }`}
          >
            <Icon name="user" className="h-4 w-4" />
            Bireysel
          </Link>

          <Link
            href={href(scope, period, true)}
            aria-pressed={isTeams}
            className={`relative z-10 flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg text-[13px] font-bold transition-colors ${
              isTeams ? "text-white" : "text-ink-muted hover:text-ink"
            }`}
          >
            <Icon name="shield" className="h-4 w-4" />
            Takım
          </Link>
        </div>

        {/* ------------------------------------------------ 2. Alan çipleri */}
        {/*
          YATAY KAYDIRMA KALDIRILDI (D38 FAZ S).

          ÖNCEKİ DURUM: dört çip `HScroll` içindeydi — kaydırılabilir bir
          şerit, kenarlarında ok düğmeleri ve solma maskesi. Dört öğe
          390px'e RAHAT sığıyor; kaydırma da oklar da hiç gerekmiyordu
          ve ekranın sağında "burada daha çok şey var" izlenimi
          veriyordu.

          Artık dört EŞİT sütun: `grid-cols-4`. Çipler kartın sol ve sağ
          kenarına tam hizalı, aralarındaki boşluk eşit. Etiketler
          12px — 13px'te "Türkiye" 77px'lik sütuna sığmıyordu.

          `flex-wrap` denendi ve elendi: dar ekranda dördüncü çip alt
          satıra düşüyor ve blok bir satır büyüyordu; eşit ızgara her
          genişlikte tek satır.
        */}
        <nav aria-label="Alan" className="mt-2">
          <ul className="grid grid-cols-4 gap-1.5">
            {AREA_SCOPES.map((item) => {
              const isActive = item.key === scope;
              return (
                <li key={item.key}>
                  <Link
                    href={href(item.key, period, isTeams)}
                    aria-current={isActive ? "page" : undefined}
                    className={`press-soft flex min-h-[40px] items-center justify-center gap-1 rounded-xl px-1 text-[12px] font-semibold ${
                      isActive
                        ? "chip-active text-white"
                        : "border border-edge bg-surface font-medium text-ink-muted hover:text-ink"
                    }`}
                  >
                    <Icon
                      name={SCOPE_ICON[item.key] ?? "trophy"}
                      className="h-4 w-4 shrink-0"
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ---------------------------------------------------- 3. Dönem */}
        <nav aria-label="Dönem" className="mt-2">
          <ul className="flex gap-1.5">
            {PERIODS.map((item) => {
              const isActive = item.key === period;
              return (
                <li key={item.key} className="flex-1">
                  <Link
                    href={href(scope, item.key, isTeams)}
                    aria-current={isActive ? "page" : undefined}
                    className={`press-soft flex min-h-[40px] items-center justify-center rounded-xl text-[13px] transition-colors ${
                      isActive
                        ? "chip-active font-bold text-white"
                        : "border border-edge bg-surface font-medium text-ink-muted hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
