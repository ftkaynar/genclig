import Image from "next/image";

/*
  Kimlik ekranlarının yükleme yüzü — uygulamanın "logo anı" (D36 FAZ SP).

  ÖNCEKİ DURUM: `(auth)` grubunda hiç loading.tsx yoktu. `(user)` grubunun
  iskeleti başka bir route grubunda olduğu için buraya miras kalmıyor ve
  kök seviyede de bir tane bulunmuyordu — yani giriş/kayıt arası geçişte
  ekran boş kalıyor, kullanıcı hiçbir şey olmuyormuş gibi bekliyordu.

  Zemin AÇIK marka gradyanı: PWA'nın manifest'ten gelen açılış ekranıyla
  (background_color #EEF1F8 + aynı ışıltılar) aynı yüz. Koyu bir iskelet
  koymak denendi ve elendi — sistem splash'i açık, uygulama içi bekleme
  koyu olunca açılış iki farklı markaya bölünüyordu.

  Logo şeffaf sürüm: mürekkebi koyu (en koyu %5'i #10223b) ve bu zeminde
  14.13:1 kontrast veriyor.
*/
export default function AuthLoading() {
  return (
    <div className="brand-ground flex min-h-dvh w-full flex-col items-center justify-center gap-4">
      <Image
        src="/brand/transparan-logo.png"
        alt=""
        width={96}
        height={96}
        priority
        className="h-24 w-24 animate-pulse"
      />
      <span className="sr-only">Yükleniyor</span>
    </div>
  );
}
