import Link from "next/link";

import { Icon } from "@/components/ui/icon";

/*
  Kullanıcı PWA'sının alt gezinmesi — v3 (D32 FAZ NAV2).

  Ortadaki Görevler sekmesi yükseltilmiş gradyan daire: uygulamanın asıl
  eylemi görev yapmak ve beş eşit sekme arasında kaybolmuştu. Diğer dördü
  ikon + etiket; aktif olan dolgun renkte, pasifler soluk.

  Beş sekmede kalındı. Altıncı sekme denendi ve elendi: 360px genişlikte
  dokunma hedefleri parmak genişliğinin altına iniyordu. Arkadaşlar,
  Takımım, Ödüller ve Destek ana sayfadaki hızlı erişim ızgarasında.

  `prefetch` bilerek varsayılanda (açık) bırakıldı: sekmeler arası geçiş
  ağ turu beklemeden açılsın.
*/
const ITEMS = [
  { key: "home", label: "Ana Sayfa", href: "/", icon: "home" },
  { key: "discover", label: "Keşfet", href: "/kesfet", icon: "compass" },
  { key: "tasks", label: "Görevler", href: "/gorevler", icon: "list-checks" },
  { key: "ranking", label: "Sıralama", href: "/siralama", icon: "trophy" },
  { key: "profile", label: "Profil", href: "/profil", icon: "user" },
] as const;

export type BottomNavKey = (typeof ITEMS)[number]["key"];

export function UserBottomNav({ active }: { active: BottomNavKey }) {
  return (
    /*
      ÖLÇÜLEN SORUN (D31 FAZ NAV): gezinme bazı ekranlarda kayıyordu.

      KÖK SEBEP İKİ PARÇA:

      1. `position: sticky` kullanılıyordu, `fixed` değil. Sticky öğe
         AKIŞTA kalıyor ve konumu kapsayıcısının yüksekliğine bağlı.
         Sayfa kapsayıcıları `min-h-dvh` ile ölçülüyor; iOS'ta URL
         çubuğu açılıp kapandıkça `dvh` DEĞİŞİYOR, kapsayıcı yeniden
         ölçülüyor ve sticky gezinme gözle görülür biçimde zıplıyordu.
         `/topluluk` ayrıca `h-dvh` kullanıyor — farklı kapsayıcı,
         farklı davranış; tutarsızlığın ikinci kaynağı buydu.

      2. Hiçbir yerde `env(safe-area-inset-bottom)` YOKTU (koddaki
         kullanım sayısı ölçüldü: 0). Ana ekran çubuğu olan
         telefonlarda gezinmenin alt kenarı jest çubuğunun altında
         kalıyor, sekmeler yarım görünüyordu.

      DÜZELTME: `fixed inset-x-0 bottom-0` + iç kapta `mx-auto
      max-w-md` (uygulama ortalanmış, fixed öğe kapsayıcıdan çıkıyor)
      + güvenli alan dolgusu. Artık kaydırmadan ve kapsayıcı
      yüksekliğinden TAMAMEN bağımsız.

      İçerik alt boşluğu `.has-bottom-nav` ile veriliyor (globals.css):
      gezinme akıştan çıktığı için altında kalan içeriği artık kimse
      itmiyor.

      D32 FAZ NAV2 — yüzey: düz `bg-card` yerine yarı saydam + bulanık
      taban (.nav-base). Üstünden kayan içerik gezinmenin ARDINDAN
      geçiyor gibi duruyor; düz opak şerit uygulamayı iki ayrı katmana
      bölüyordu. Bulanıklığı desteklemeyen tarayıcıda `.nav-base` opak
      karta düşüyor (globals.css'te @supports ile).
    */
    <nav
      aria-label="Ana gezinme"
      className="nav-base fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)]"
    >
      {/*
        Orta düğmenin oturduğu kubbe.

        Daire önceden gezinmenin üst kenarını KESİYORDU; ring-4 ile
        maskelenmişti ama kenar çizgisi dairenin arkasından geçmeye
        devam ediyordu. Kubbe o kenarı yukarı doğru büküyor, daire
        gerçekten şeridin içinden çıkıyormuş gibi duruyor.

        Denenen ve elenen alternatif: SVG maske. Aynı görüntüyü
        veriyordu ama tema değişince arka plan rengini takip etmiyordu
        (aynı gerekçeyle kupon biletinde de radial-gradient seçilmişti).
      */}
      <span aria-hidden className="nav-dome" />

      <ul className="relative mx-auto flex w-full max-w-md items-end justify-between px-2 pb-2 pt-1.5 sm:max-w-3xl lg:max-w-5xl">
        {ITEMS.map((item) => {
          const isActive = item.key === active;

          // Ortadaki sekme: yükseltilmiş gradyan daire.
          if (item.key === "tasks") {
            return (
              <li key={item.key} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className="group flex flex-col items-center gap-1"
                >
                  {/*
                    Daire HER ZAMAN büyük (h-16). Önceden yalnız aktifken
                    scale-105 ile büyüyordu; yani "ana eylem" vurgusu
                    ancak zaten o ekrandayken görünüyordu — tam tersi
                    gerekiyor. Aktiflik artık parıltı halkasıyla
                    anlatılıyor, boyutla değil.
                  */}
                  <span
                    className={`brand-gradient nav-dial -mt-7 flex h-16 w-16 items-center justify-center rounded-full text-white transition-transform duration-[var(--motion-fast)] ease-out group-active:scale-95 ${
                      isActive ? "nav-glow" : ""
                    }`}
                  >
                    <Icon
                      name={item.icon}
                      className="h-7 w-7"
                      strokeWidth={isActive ? 2.6 : 2.1}
                    />
                  </span>
                  <span
                    className={`text-[11px] transition-colors duration-[var(--motion-fast)] ${
                      isActive
                        ? "font-bold text-primary-ink"
                        : "font-medium text-ink-muted"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          }

          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className="group flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg py-1"
              >
                {/*
                  Aktif sekme üç sinyal birden veriyor: dolgun ikon
                  (kalın çizgi + renkli chip), hafif yukarı kayma ve
                  altındaki minik nokta. Renk tek başına ayırt edici
                  değil; kayma ve nokta renkten bağımsız okunuyor.
                */}
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-[var(--motion-fast)] ease-out group-active:scale-90 ${
                    isActive
                      ? "-translate-y-0.5 bg-primary/15 text-primary-ink"
                      : "text-ink-muted group-hover:text-ink"
                  }`}
                >
                  <Icon
                    name={item.icon}
                    className="h-[18px] w-[18px]"
                    // Aktif sekmede daha kalın çizgi: dolu ikon hissi
                    // veriyor, ayrı bir "filled" ikon kümesi taşımadan.
                    strokeWidth={isActive ? 2.6 : 1.9}
                  />
                </span>
                <span
                  className={`text-[10px] transition-colors duration-[var(--motion-fast)] ${
                    isActive
                      ? "font-bold text-primary-ink"
                      : "font-medium text-ink-muted"
                  }`}
                >
                  {item.label}
                </span>
                {/*
                  Aktiflik noktası. Yer HER ZAMAN ayrılıyor (pasifte
                  saydam): görünürlüğü açıp kapamak sekmenin yüksekliğini
                  değiştiriyor ve gezinme her geçişte 3px zıplıyordu.
                */}
                <span
                  aria-hidden
                  className={`h-1 w-1 rounded-full transition-opacity duration-[var(--motion-fast)] ${
                    isActive ? "bg-primary opacity-100" : "opacity-0"
                  }`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
