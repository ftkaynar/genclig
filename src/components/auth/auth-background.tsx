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

  D39 — PERDELER ÖLÇÜLEREK İNCELTİLDİ. Önceki hâlde fotoğrafın
  ortasında bile %25 genel karartma vardı, form ekranlarında üstüne
  `blur-sm` biniyordu ve manzara seçilmiyordu. Üçü de gitti/azaldı:

    - genel karartma  %25 -> %10
    - üst perde       %85/%45 -> %62/%24 (yükseklik 2/5 aynı)
    - alt perde       opak/%75, yükseklik 3/5 -> %86/%38, 1/2
    - form ekranı bulanıklığı -> KALDIRILDI

  Bulanıklık gereksizdi: form kartının kendisi `backdrop-filter:
  blur(18px)` taşıyor, yani kartın ARKASINI zaten bulanıklaştırıyor.
  Tüm fotoğrafı ayrıca bulanıklaştırmak kartın dışındaki alanı —
  fotoğrafın görünen tek kısmını — boşuna söndürüyordu.

  Sınır metin okunurluğu: her perde, kontrast ölçümünün izin verdiği
  en düşük değere indirildi (kanıt NIGHT-REPORT-20).

  `priority`: bu görsel ilk ekranın kendisi; tembel yüklenirse
  kullanıcı bir an boş koyu ekran görüyor.

  `quality={82}`: perdeler inceldiği için fotoğraf artık gerçekten
  görünüyor; 72'de gökyüzü gradyanında bantlanma ölçüldü.
*/
export function AuthBackground() {
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
        quality={82}
        sizes="100vw"
        className="object-cover object-center"
      />

      {/* Genel koyulaştırma — fotoğraf ile arayüzü ayıracak kadar, o kadar. */}
      <div className="absolute inset-0 bg-brand/10" />

      {/* Alt perde: buton bölgesi. */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#050210]/86 via-[#050210]/38 to-transparent" />

      {/* Üst perde: logo bölgesi — parlak gökyüzünü bastırıyor. */}
      <div className="absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-[#050210]/62 via-[#050210]/24 to-transparent" />
    </div>
  );
}
