import Image from "next/image";
import Link from "next/link";

import { AuthBackground } from "./auth-background";

/*
  Karşılama ekranı — oturumsuz ana giriş (D35 FAZ A).

  ÖNCEKİ DURUM: bu ekran `(user)` kabuğunun içindeydi ve HUD, ödül FAB'ı
  ve alt gezinme üçü birden çiziliyordu (ölçüldü). Henüz hesabı olmayan
  bir ziyaretçiye beş sekmeli bir uygulama gezinmesi göstermek, hem
  yalan (hiçbiri çalışmıyor) hem de dikkat dağıtıcıydı — ekranın tek
  işi var: kaydol ya da giriş yap.

  Artık ÇIPLAK: fotoğraf, logo, iki buton. Başka hiçbir şey yok.

  Yerleşim fotoğrafın kompozisyonuna göre: figür sol altta, gökyüzü
  sağ üstte. Logo üstte (perdenin bastırdığı gökyüzünde), butonlar
  altta (zaten koyu olan teras bölgesinde). Ortada boşluk bırakılıyor —
  fotoğraftaki genç ve manzara görünsün; ekranı doldurmak, fotoğrafı
  duvar kâğıdına indirgerdi.
*/
export function WelcomeScreen() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-brand">
      <AuthBackground />

      <main
        className="relative z-10 mx-auto flex min-h-dvh w-full max-w-sm flex-col px-6"
        style={{
          paddingTop: "max(3.5rem, calc(env(safe-area-inset-top) + 2.5rem))",
          paddingBottom: "max(2.5rem, calc(env(safe-area-inset-bottom) + 1.5rem))",
        }}
      >
        {/* ------------------------------------------------- üst: kimlik */}
        <div className="flex flex-col items-center text-center">
          <Image
            src="/brand/transparan-logo.png"
            alt="GençLİG logosu"
            width={180}
            height={180}
            priority
            className="auth-logo auth-enter h-28 w-28 sm:h-32 sm:w-32"
          />

          <h1
            className="wordmark auth-enter mt-4 text-4xl"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            GençLİG
          </h1>

          <p
            className="auth-enter mt-2.5 text-sm font-medium text-white/80"
            style={{ "--i": 2 } as React.CSSProperties}
          >
            Şehrini değiştir, kartını parlat.
          </p>
        </div>

        {/*
          Orta boşluk: fotoğraf nefes alsın. flex-1 ile esniyor, yani
          kısa ekranda kayboluyor ve uzun ekranda büyüyor — sabit bir
          boşluk küçük telefonlarda butonları ekran dışına itiyordu.
        */}
        <div className="flex-1" />

        {/* ------------------------------------------------- alt: eylem */}
        <div className="flex flex-col gap-3">
          <Link
            href="/kayit"
            className="auth-enter btn-surface btn-primary press-soft flex min-h-[54px] items-center justify-center rounded-2xl text-base font-bold text-white"
            style={{ "--i": 3 } as React.CSSProperties}
          >
            Hemen Başla
          </Link>

          {/*
            İkincil buton cam efektli: birincilin yanında "ikinci
            seçenek" olduğu belli olmalı ama pasif görünmemeli. Soluk
            gri kenar denendi ve elendi — fotoğrafın üstünde neredeyse
            görünmüyordu.
          */}
          <Link
            href="/giris"
            className="auth-glass auth-enter press-soft flex min-h-[54px] items-center justify-center rounded-2xl text-base font-bold text-white"
            style={{ "--i": 4 } as React.CSSProperties}
          >
            Giriş Yap
          </Link>
        </div>
      </main>
    </div>
  );
}
