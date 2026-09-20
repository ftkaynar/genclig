/**
 * public/brand/gorevler1.png + gorevler2.png kontakt sayfalarını görev
 * görsellerine ayırır (D40 FAZ A).
 *
 * Üretilenler:
 *   public/task-art/art-01.webp .. art-40.webp      — kart kapağı (yatay sahne)
 *   public/task-art/cover-01.webp .. cover-40.webp  — detay kapağı (geniş şerit)
 *   public/task-art/manifest.json                   — ölçü/eşleme belgesi
 *
 * KAYNAK YAPISI ÖLÇÜLDÜ, TAHMİN EDİLMEDİ:
 *
 *   Her iki sayfa da 1536x1024 ve 5 sütun x 4 hücre taşıyor. Her hücre
 *   bir ÇİFT: üstte yatay sahne (oran ~1.6-2.0), altında daha geniş
 *   şerit (oran ~3.5-4.0). Yani sayfa başına 20 çift, toplam 40 çift.
 *
 *   gorevler2'de çiftin iki parçası beyaz boşlukla ayrılıyor; sütun
 *   izdüşümü 8 bant veriyor. gorevler1'de parçalar BİTİŞİK — izdüşüm
 *   4 bant veriyor ve her bant bir çift.
 *
 *   AMA kural kaynak başına DEĞİL: gorevler1'in 3. sütun 4. hücresinde
 *   boşluk var, diğer 19'unda yok. Bu yüzden karar bant bant veriliyor
 *   (bkz. main içindeki döngü), kaynağa bakılarak değil.
 *
 * NEDEN 3:4 DEĞİL:
 *
 *   Dilim 3:4 kart görseli istiyordu. Kaynakta 3:4 parça YOK; hepsi
 *   yatay. Üstelik uygulamadaki kart kapağı alanı ölçüldüğünde
 *   172x101 = 1.70 oranında, yani zaten yatay. Yatay sahneyi 3:4'e
 *   kırpmak önce genişliğin yarısını atmak, sonra kartta tekrar
 *   yataya kırpmak demekti — iki kez kayıp. Parçalar KAYNAK
 *   ORANINDA bırakıldı.
 *
 * NEDEN YENİDEN BOYUTLANDIRMA YOK:
 *
 *   Dilim "YAPAY BÜYÜTME YOK, kaynak neyse o" diyor. Parçalar
 *   275-287 px genişlikte ve birbirinden birkaç piksel farklı. Hepsini
 *   tek ölçüye getirmek en küçüğü büyütmek ya da en büyüğü küçültmek
 *   demekti. Parçalar kendi doğal ölçüsünde yazılıyor; ızgara ve kart
 *   sabit oranlı kutuya `bg-cover` ile bastığı için düzensizlik
 *   görünmüyor.
 *
 * KÖŞE KIRPMASI:
 *
 *   Parçaların köşeleri yuvarlatılmış ve köşelerde sayfa zemini
 *   (beyaz) kalıyor. Yarıçap ölçüldü: gorevler1'de 9 px, gorevler2'de
 *   7 px. Her parça kendi yarıçapı kadar içeri kırpılıyor, yoksa
 *   kartın kapak alanında beyaz köşe takozları görünüyordu.
 *
 * NEDEN TEK SEFERLİK SCRIPT: kaynak sayfa elle hazırlanıyor ve nadiren
 * değişiyor. Her derlemede sharp koşturmak build süresine kalıcı yük
 * bindirirdi; çıktılar repoda duruyor (aynı gerekçe generate-icons.mjs).
 *
 * Koşma: pnpm art:slice
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public", "task-art");

/** Kaynaklar. `kose` = ölçülen köşe yarıçapı (bkz. başlık). */
const KAYNAKLAR = [
  { dosya: "gorevler1.png", ilkNo: 1, kose: 9 },
  { dosya: "gorevler2.png", ilkNo: 21, kose: 7 },
];

/**
 * Parça açıklamaları — yönetim panelindeki seçici ızgarasında görselin
 * altında ve `title`'ında görünüyor. Sıra okuma sırası: soldan sağa,
 * yukarıdan aşağı; gorevler1 01-20, gorevler2 21-40.
 */
const IPUCLARI = [
  "Ziyaret · Galata ve şehir",      // 01
  "Park · çimende grup",            // 02
  "Sosyal · çimende sohbet",        // 03
  "Müzik · konser sahnesi",         // 04
  "Spor · basketbol",               // 05
  "Çevre · fidan dikimi",           // 06
  "Temizlik · sahilde atık",        // 07
  "Yardım · bağış kutusu",          // 08
  "Spor · sahilde koşu",            // 09
  "Kültür · müzede heykel",         // 10
  "Kariyer · pencere önünde çalışma", // 11
  "Sosyal · gün batımında grup",    // 12
  "Sanat · duvar resmi",            // 13
  "Teknoloji · drone ve tablet",    // 14
  "Teknoloji · kulaklıkla kodlama", // 15
  "Tarih · antik sütunlar",         // 16
  "Lezzet · kafede buluşma",        // 17
  "Müzik · festival kalabalığı",    // 18
  "Hayvan · parkta köpek",          // 19
  "Doğa · dağ manzarası",           // 20
  "Yürüyüş · sahil yolu",           // 21
  "Fotoğraf · Galata çekimi",       // 22
  "Sosyal · grup sohbeti",          // 23
  "Takım · el ele dayanışma",       // 24
  "Duyuru · broşür dağıtımı",       // 25
  "Esnaf · dükkân ziyareti",        // 26
  "Eğitim · atölye sunumu",         // 27
  "Paylaşım · sosyal medya",        // 28
  "Hayvan · köpek dostluğu",        // 29
  "Temizlik · parkta atık",         // 30
  "Spor · sahilde koşu",            // 31
  "Kültür · müze salonu",           // 32
  "Yardım · kutu teslimi",          // 33
  "Çevre · fidan dikimi",           // 34
  "Festival · pazar tezgâhları",    // 35
  "Geri dönüşüm · kutular",         // 36
  "Müzik · sahne ve kalabalık",     // 37
  "Fotoğraf · gün batımı",          // 38
  "Eğitim · şehirde okuma",         // 39
  "Teknoloji · laptopta çalışma",   // 40
];

/** Sayfanın zemini beyaz; eşik ölçülerek seçildi. */
function beyazMi(d, i) {
  return d[i] > 238 && d[i + 1] > 238 && d[i + 2] > 238;
}

/** Doluluk profilinden bantları çıkarır. */
function bantlar(profil, esik, minUzunluk) {
  const cikti = [];
  let bas = -1;
  for (let i = 0; i < profil.length; i++) {
    const dolu = profil[i] > esik;
    if (dolu && bas < 0) bas = i;
    if ((!dolu || i === profil.length - 1) && bas >= 0) {
      const son = dolu ? i : i - 1;
      if (son - bas + 1 >= minUzunluk) cikti.push([bas, son - bas + 1]);
      bas = -1;
    }
  }
  return cikti;
}

/**
 * Bitişik çiftte ayrım satırını bulur: bir önceki satıra göre renk
 * farkı en yüksek satır.
 *
 * DENENEN VE ELENEN (1): sabit oran (örn. hücrenin %68'i). Elendi —
 * hücreden hücreye sahne/şerit oranı değişiyor (ölçüldü: 1.62-2.04).
 *
 * DENENEN VE ELENEN (2): "açık piksel oranı en yüksek satır". Elendi —
 * ayrım çizgisi ince ve iki yanındaki görseller koyuysa oran %36'ya
 * kadar düşüyor (20 hücrede %36-%96 arası ölçüldü) ve eşik seçilemiyor.
 * Satır farkı sinyali aynı satırı 20 hücrenin 20'sinde ±1 içinde
 * veriyor; eşik gerektirmiyor, tepe noktası yeterli.
 */
function ayrimSatiri(data, W, ch, cx, cw, cy, chh) {
  let enIyi = -1;
  let enFark = -1;
  for (let y = Math.round(chh * 0.45); y < Math.round(chh * 0.9); y++) {
    let fark = 0;
    for (let x = cx + 6; x < cx + cw - 6; x++) {
      const i = ((cy + y) * W + x) * ch;
      const j = ((cy + y - 1) * W + x) * ch;
      fark += Math.abs(data[i] - data[j]) + Math.abs(data[i + 1] - data[j + 1])
        + Math.abs(data[i + 2] - data[j + 2]);
    }
    if (fark > enFark) { enFark = fark; enIyi = y; }
  }
  return enIyi;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const parcalar = [];

  for (const kaynak of KAYNAKLAR) {
    const yol = path.join(ROOT, "public", "brand", kaynak.dosya);
    const { data, info } = await sharp(yol).removeAlpha().raw()
      .toBuffer({ resolveWithObject: true });
    const { width: W, height: H, channels: ch } = info;
    console.log(`\n${kaynak.dosya}: ${W}x${H}`);

    // Sütun bantları
    const sp = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      let n = 0;
      for (let y = 0; y < H; y++) if (!beyazMi(data, (y * W + x) * ch)) n++;
      sp[x] = n / H;
    }
    const sutunlar = bantlar(sp, 0.05, 40);
    if (sutunlar.length !== 5) throw new Error(`${kaynak.dosya}: 5 sütun bekleniyordu, ${sutunlar.length} bulundu`);

    // Sütun başına satır bantları
    const hucreler = [];
    for (const [cx, cw] of sutunlar) {
      const rp = new Float32Array(H);
      for (let y = 0; y < H; y++) {
        let n = 0;
        for (let x = cx; x < cx + cw; x++) if (!beyazMi(data, (y * W + x) * ch)) n++;
        rp[y] = n / cw;
      }
      const satirlar = bantlar(rp, 0.12, 20);

      /*
        Çiftler TEK TİP DEĞİL: gorevler2'de sahne ile şerit arasında
        beyaz boşluk var (bant ayrı çıkıyor), gorevler1'de bitişikler —
        AMA gorevler1'in bir hücresinde (3. sütun, 4. satır) boşluk var.
        Bu yüzden kaynak başına bayrak yerine BANT BANT karar veriliyor:
        bir sonraki bandın oranı şerit oranındaysa (>= 2.6) çift zaten
        ayrıktır; değilse bant bitişik bir çifttir ve içinde bölünür.
      */
      const oncesi = hucreler.length;
      let i = 0;
      while (i < satirlar.length) {
        const [cy, chh] = satirlar[i];
        const sonraki = satirlar[i + 1];
        if (sonraki && cw / sonraki[1] >= 2.6) {
          hucreler.push({
            sahne: { x: cx, y: cy, w: cw, h: chh },
            serit: { x: cx, y: sonraki[0], w: cw, h: sonraki[1] },
          });
          i += 2;
        } else {
          const ay = ayrimSatiri(data, W, ch, cx, cw, cy, chh);
          hucreler.push({
            sahne: { x: cx, y: cy, w: cw, h: ay - 1 },
            serit: { x: cx, y: cy + ay + 2, w: cw, h: chh - ay - 2 },
          });
          i += 1;
        }
      }
      if (hucreler.length - oncesi !== 4) {
        throw new Error(`${kaynak.dosya}: sütunda 4 çift bekleniyordu, ${hucreler.length - oncesi}`);
      }
    }

    /*
      Okuma sırası: hücreler sütun sütun toplandı, ama numaralar
      SOLDAN SAĞA gitmeli — yoksa manifest'teki ipucu ile görsel
      kayar. Sütun içi sıra satır sırası olduğu için indeks
      dönüştürülüyor.
    */
    for (let satir = 0; satir < 4; satir++) {
      for (let sutun = 0; sutun < 5; sutun++) {
        const h = hucreler[sutun * 4 + satir];
        const no = kaynak.ilkNo + satir * 5 + sutun;
        const ad = String(no).padStart(2, "0");
        const k = kaynak.kose;

        /*
          Köşe takozunu silmek için YALNIZ YATAY kırpma yeter.

          Yuvarlak köşe, merkezi (r, r) olan çeyrek daire: beyaz takoz
          sadece x < r VE y < r bölgesinde var. x'i [r, w-r] aralığına
          çekmek dört takozu da siliyor; ayrıca dikey kırpmak boşuna
          içerik atıyor. İlk yazımda dört kenardan da r kadar kırpmıştım
          ve 80 px'lik şeridin %22'si gidiyordu (ölçüldü: kapak boyu
          45-66 px'e düşmüştü).

          Kenar yumuşatma payı olarak yatayda +1, dikeyde 2 px.
        */
        const kes = async (kutu, dosyaAdi) => {
          const meta = await sharp(yol)
            .extract({
              left: kutu.x + k + 1, top: kutu.y + 2,
              width: kutu.w - 2 * (k + 1), height: kutu.h - 4,
            })
            .webp({ quality: 86 })
            .toFile(path.join(OUT_DIR, dosyaAdi));
          return { dosya: dosyaAdi, width: meta.width, height: meta.height, bytes: meta.size };
        };

        const kart = await kes(h.sahne, `art-${ad}.webp`);
        const kapak = await kes(h.serit, `cover-${ad}.webp`);
        parcalar.push({
          key: `art-${ad}`,
          kaynak: kaynak.dosya,
          hint: IPUCLARI[no - 1] ?? `Görsel ${ad}`,
          kart, kapak,
        });
      }
    }
  }

  parcalar.sort((a, b) => a.key.localeCompare(b.key));

  const manifest = {
    note: "Görev görselleri (D40). Her anahtarın bir kart kapağı (yatay sahne) ve bir detay kapağı (geniş şerit) var. Parçalar kaynak oranında ve kaynak çözünürlüğünde; yeniden boyutlandırma yapılmıyor. Kurallar docs/GOREV-GORSEL-SPEC.md içinde.",
    kaynaklar: KAYNAKLAR.map((k) => k.dosya),
    uretim: "pnpm art:slice",
    items: parcalar,
  };
  await writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

  const kartEn = parcalar.map((p) => p.kart.width);
  const kartBoy = parcalar.map((p) => p.kart.height);
  const kapakEn = parcalar.map((p) => p.kapak.width);
  const kapakBoy = parcalar.map((p) => p.kapak.height);
  const toplam = parcalar.reduce((s, p) => s + p.kart.bytes + p.kapak.bytes, 0);
  console.log(`\n${parcalar.length} çift yazıldı (${parcalar.length * 2} dosya)`);
  console.log(`kart  : ${Math.min(...kartEn)}-${Math.max(...kartEn)} x ${Math.min(...kartBoy)}-${Math.max(...kartBoy)}`);
  console.log(`kapak : ${Math.min(...kapakEn)}-${Math.max(...kapakEn)} x ${Math.min(...kapakBoy)}-${Math.max(...kapakBoy)}`);
  console.log(`toplam: ${(toplam / 1024).toFixed(0)} KB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
