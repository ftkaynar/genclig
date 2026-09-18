import Image from "next/image";

/*
  Auth ekranlarının ortak arka planı (D35 FAZ A).

  giris.png: gün batımında İstanbul'a bakan sırt çantalı bir genç.
  Kompozisyon önemli — figür SOL ALTTA, parlak gökyüzü SAĞ ÜSTTE. Yani:

    üst orta  (logo)     -> parlak turuncu/mavi gökyüzü, kontrast ZAYIF
    alt       (butonlar) -> koyu figür ve teras, kontrast zaten iyi

  Bu yüzden perde TEK YÖNLÜ DEĞİL. Slice "alttan yukarı koyu degrade"
  diyordu; yalnız onu koymak logoyu parlak göğün üstünde bırakıyordu.
  İki perde var:

    1. Alttan yukarı güçlü koyu degrade — buton ve metin bölgesi
    2. Üstten aşağı orta güçte degrade — logo ve wordmark bölgesi

  Ayrıca hafif bir genel koyulaştırma (bg-brand/25): fotoğraf çok
  doygun ve arayüz öğeleri onun üstünde "yüzüyor" gibi duruyordu.

  `priority`: bu görsel ilk ekranın kendisi; tembel yüklenirse
  kullanıcı bir an boş koyu ekran görüyor.

  `quality={72}`: 2.2 MB'lık kaynak tam kalitede gereksiz — arkada
  perdelerin altında duruyor ve fark edilmiyor.
*/
export function AuthBackground({ blur = false }: { blur?: boolean }) {
  return (
    /*
      -z-10 KULLANILMIYOR (ölçüldü).

      İlk yazımda kap `-z-10` idi ve fotoğraf hiç görünmüyordu: ebeveyn
      `relative` + z-index'siz olduğu için yığın bağlamı açmıyor, negatif
      z-index'li çocuk ebeveynin KENDİ arka plan renginin (bg-brand)
      altına düşüyor. Normal akışta, DOM sırasıyla çizilmek doğru davranış:
      ebeveynin zemini, sonra bu katman, sonra içerik.
    */
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <Image
        src="/brand/giris.png"
        alt=""
        fill
        priority
        quality={72}
        sizes="100vw"
        className={`object-cover object-center ${blur ? "scale-105 blur-sm" : ""}`}
      />

      {/* Genel koyulaştırma. */}
      <div className="absolute inset-0 bg-brand/25" />

      {/* Alt perde: buton bölgesi. */}
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#050210] via-[#050210]/75 to-transparent" />

      {/* Üst perde: logo bölgesi — parlak gökyüzünü bastırıyor. */}
      <div className="absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-[#050210]/85 via-[#050210]/45 to-transparent" />
    </div>
  );
}
