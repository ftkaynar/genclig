/**
 * public/brand/gorevler.png kontakt sayfasını görev görsellerine ayırır.
 *
 * Üretilenler:
 *   public/task-art/art-01.webp .. art-20.webp  — kart kapakları (3:4)
 *   public/task-art/detay-kapak.webp            — detay sayfası kapağı
 *   public/task-art/manifest.json               — ölçü/eşleme belgesi
 *
 * NEDEN TEK SEFERLİK SCRIPT: kaynak sayfa elle hazırlanıyor ve nadiren
 * değişiyor. Her derlemede sharp koşturmak build süresine kalıcı yük
 * bindirirdi; çıktılar repoda duruyor (aynı gerekçe generate-icons.mjs).
 *
 * KOORDİNATLAR ÖLÇÜLDÜ, TAHMİN EDİLMEDİ: kaynak görselde zemin rengine
 * (#f6f9fc) göre bağlı bileşen etiketlemesiyle 21 dikdörtgen bulundu ve
 * kutular aşağıya yazıldı. Kaynak değişirse bu liste de yeniden
 * ölçülmeli — koordinatlar kaynağa BAĞLI, kaynağın kendisi değil.
 *
 * Koşma: pnpm art:slice
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "public", "brand", "gorevler.png");
const OUT_DIR = path.join(ROOT, "public", "task-art");

/** Kart kapağı hedef ölçüsü (3:4). Gerekçe manifest'te. */
const CARD_W = 192;
const CARD_H = 256;

/**
 * ANAHTAR -> KAYNAKTAKİ KUTU + İPUCU.
 *
 * Sıra kontakt sayfasının okuma sırası DEĞİL: mevcut görevler zaten
 * `art_key` taşıyor ve anahtarların bir anlamı var (art-01 "çevre",
 * art-03 "spor"...). Her fotoğraf, ANLAMI EN YAKIN anahtara verildi ki
 * yayındaki görevlerin kapağı kaymasın.
 *
 * Dört anahtarda tam karşılık yoktu (hayvan barınağı, yaşlı ziyareti,
 * festival, sahil temizliği). Onlara konu olarak yakın birer şehir/genç
 * sahnesi verildi ve ipucu yeni fotoğrafı anlatacak şekilde
 * güncellendi; o görevlerin kapağı panelden değiştirilebilir.
 */
const CARDS = [
  { key: "art-01", box: [632, 572, 183, 240], hint: "Gönüllülük · ağaç dikimi" },
  { key: "art-02", box: [629, 321, 186, 239], hint: "Sosyal · dayanışma" },
  { key: "art-03", box: [32, 320, 191, 240], hint: "Spor · koşu" },
  { key: "art-04", box: [630, 57, 184, 250], hint: "Katılım · sahne" },
  { key: "art-05", box: [435, 321, 184, 239], hint: "Eğitim · çalışma" },
  { key: "art-06", box: [435, 56, 184, 251], hint: "Toplanma · buluşma" },
  { key: "art-07", box: [1221, 56, 187, 250], hint: "Temizlik · atık toplama" },
  { key: "art-08", box: [1420, 55, 191, 251], hint: "Yardım · dayanışma" },
  { key: "art-09", box: [235, 57, 188, 250], hint: "Park · yeşil alan" },
  { key: "art-10", box: [435, 572, 184, 240], hint: "Müzik · konser" },
  { key: "art-11", box: [827, 57, 187, 251], hint: "Oyun · basketbol" },
  { key: "art-12", box: [1025, 56, 184, 250], hint: "Çevre · fide" },
  { key: "art-13", box: [31, 57, 191, 251], hint: "Ziyaret · şehir turu" },
  { key: "art-14", box: [235, 321, 188, 239], hint: "Kültür · müze" },
  { key: "art-15", box: [1026, 321, 183, 239], hint: "Kariyer · çalışma masası" },
  { key: "art-16", box: [1222, 321, 186, 239], hint: "Teknoloji · dijital" },
  { key: "art-17", box: [828, 321, 186, 240], hint: "Sanat · duvar resmi" },
  { key: "art-18", box: [31, 571, 192, 241], hint: "Tarih · miras" },
  { key: "art-19", box: [236, 572, 187, 240], hint: "Lezzet · kahvaltı" },
  { key: "art-20", box: [1420, 320, 191, 240], hint: "Doğa · yürüyüş" },
];

/** Detay sayfası kapağı — kaynakta tek parça, sağ altta. */
const COVER = { file: "detay-kapak", box: [831, 676, 781, 238] };

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const meta = await sharp(SOURCE).metadata();
  console.log(`kaynak: ${meta.width}x${meta.height}`);

  for (const card of CARDS) {
    const [left, top, width, height] = card.box;

    /*
      `fit: cover` — `fill` DEĞİL. Kaynak kutuların yüksekliği 239-251
      arasında oynuyor (kenar yumuşatması yüzünden kenar tespiti birkaç
      piksel oynuyor). `fill` ile 3:4'e zorlamak görseli dikey olarak
      %7'ye varan oranda esnetiyordu; `cover` esnetmiyor, gerekirse
      kenardan kırpıyor.
    */
    await sharp(SOURCE)
      .extract({ left, top, width, height })
      .resize(CARD_W, CARD_H, { fit: "cover", position: "centre" })
      .webp({ quality: 82 })
      .toFile(path.join(OUT_DIR, `${card.key}.webp`));
  }
  console.log(`${CARDS.length} kart kapağı yazıldı (${CARD_W}x${CARD_H})`);

  const [cl, ct, cw, ch] = COVER.box;
  await sharp(SOURCE)
    .extract({ left: cl, top: ct, width: cw, height: ch })
    .webp({ quality: 84 })
    .toFile(path.join(OUT_DIR, `${COVER.file}.webp`));
  console.log(`detay kapağı yazıldı (${cw}x${ch})`);

  /*
    Manifest kod tarafından OKUNMUYOR (gerekçe lib/tasks/art.ts içinde);
    görsel üreten/yerine koyan taraf için kaynak belge.
  */
  await writeFile(
    path.join(OUT_DIR, "manifest.json"),
    `${JSON.stringify(
      {
        note:
          "Görev görselleri. Kart kapakları 3:4, detay kapağı geniş. " +
          "Ölçü ve format kuralları docs/GOREV-GORSEL-SPEC.md içinde. " +
          "Bu dosya koda bağlı değil; üretim tarafı için belge.",
        kaynak: "public/brand/gorevler.png (kontakt sayfası)",
        uretim: "pnpm art:slice",
        kart: { width: CARD_W, height: CARD_H, oran: "3:4", format: "webp" },
        detayKapak: { width: cw, height: ch, format: "webp" },
        items: CARDS.map((c) => ({
          key: c.key,
          file: `${c.key}.webp`,
          hint: c.hint,
        })),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log("manifest.json yazıldı");
}

main().catch((error) => {
  console.error("Görsel ayırma başarısız:", error);
  process.exitCode = 1;
});
