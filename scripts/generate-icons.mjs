/**
 * Marka görsellerini public/brand/logo.png kaynağından üretir.
 *
 * Üretilenler:
 *   public/brand/logo-mark.png  — zemini şeffaflaştırılmış, kırpılmış logo
 *   public/icons/icon-192.png   — açık marka zemini üzerine ortalanmış mark
 *   public/icons/icon-512.png   — aynısı, 512 px
 *   public/icons/icon-32.png    — favicon (sekme)
 *   public/icons/icon-16.png    — favicon (küçük)
 *   public/apple-touch-icon.png — iOS ana ekran ikonu, 180 px
 *   public/favicon.ico          — 32+16 px çok boyutlu ICO
 *
 * Neden tek seferlik script, build adımı değil: logo yılda birkaç kez değişir,
 * her derlemede sharp çalıştırmak build süresine kalıcı yük bindirirdi. Çıktılar
 * repoda tutuluyor, script yalnızca logo değişince elle koşuluyor.
 *
 * Kaynak logo opak (kirli beyaz) bir zemine sahip. İkonlar kendi marka zeminini
 * çizdiği için kaynak zemin şeffaflaştırılıyor; aksi halde ikonun ortasında
 * kirli beyaz bir kare kalırdı.
 *
 * Koşma: pnpm brand:icons
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "public", "brand", "logo.png");
const MARK_OUT = path.join(ROOT, "public", "brand", "logo-mark.png");
const ICON_DIR = path.join(ROOT, "public", "icons");
const APPLE_OUT = path.join(ROOT, "public", "apple-touch-icon.png");

/*
  AÇIK MARKA ZEMİNİ (D36 FAZ SP).

  ÖLÇÜLEN SORUN: ikonlar #0B1220 koyu lacivert zemin üzerine
  basılıyordu. Logo ise sol altta koyu laciverte, sağ üstte yeşile
  giden bir gradyan. Koyu zeminde logonun KOYU YARISI kayboluyordu —
  opak piksellerin en koyu %5'i (#10223b) ile zemin arasındaki kontrast
  **1.17:1**. Figürün yarısı zemine karışıyor, geriye tek başına
  anlamsız bir yeşil parça kalıyordu. Aynı mürekkep açık zeminde
  **14.13:1**.

  Yeni zemin: açık gri-mavi taban + mor ve cyan yumuşak ışıltı
  (v2 paletinin açık-hava okuması). Düz beyaz denendi ve elendi —
  marka kimliği taşımıyor ve iOS'un beyaz splash'inden ayırt
  edilemiyordu.

  Yeşil uç açık zeminde 2.08:1'e düşüyor; bu bir METİN değil büyük bir
  grafik işaret, şekli koyu yarısı taşıyor. İki uçtan birini feda etmek
  gerekiyorsa şekli taşıyan yarıyı korumak doğru olan.
*/
const ICON_BASE = "#EEF1F8";
const ICON_GLOW_VIOLET = "#7C3AED";
const ICON_GLOW_CYAN = "#22D3EE";

/** Açık marka zemini: SVG'den rasterleştiriliyor (düz renk gradyan taşımıyor). */
function brandGroundSvg(size) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <radialGradient id="mor" cx="22%" cy="18%" r="72%">
      <stop offset="0%" stop-color="${ICON_GLOW_VIOLET}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${ICON_GLOW_VIOLET}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="cyan" cx="82%" cy="86%" r="74%">
      <stop offset="0%" stop-color="${ICON_GLOW_CYAN}" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="${ICON_GLOW_CYAN}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="${ICON_BASE}"/>
  <rect width="${size}" height="${size}" fill="url(#mor)"/>
  <rect width="${size}" height="${size}" fill="url(#cyan)"/>
</svg>`);
}

/** İkon kenarından bırakılan boşluk oranı. Mark, kenarlara yapışmasın diye. */
const ICON_PADDING_RATIO = 0.16;

/**
 * Zemin şeffaflaştırma eşikleri (0-255 arası kanal farkı).
 * BELOW altındaki fark tamamen zemin sayılır, ABOVE üstü tamamen logo.
 * Aradaki bant kenar yumuşatmasını korur; tek eşik kullanılsaydı logo
 * kenarlarında testere dişi oluşurdu.
 */
const ALPHA_FADE_BELOW = 12;
const ALPHA_FADE_ABOVE = 48;

/**
 * Kaynak görselin zeminini şeffaflaştırır.
 * Zemin rengi sol üst pikselden okunur; logo her zaman ortada duruyor ve
 * köşeler zemin oluyor, bu yüzden sabit bir renk varsaymaktan daha güvenli.
 */
async function makeTransparentMark() {
  const { data, info } = await sharp(SOURCE)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const bgR = data[0];
  const bgG = data[1];
  const bgB = data[2];

  for (let i = 0; i < data.length; i += channels) {
    const distance = Math.max(
      Math.abs(data[i] - bgR),
      Math.abs(data[i + 1] - bgG),
      Math.abs(data[i + 2] - bgB),
    );

    let alpha;
    if (distance <= ALPHA_FADE_BELOW) {
      alpha = 0;
    } else if (distance >= ALPHA_FADE_ABOVE) {
      alpha = 255;
    } else {
      alpha = Math.round(
        ((distance - ALPHA_FADE_BELOW) / (ALPHA_FADE_ABOVE - ALPHA_FADE_BELOW)) *
          255,
      );
    }

    data[i + 3] = alpha;
  }

  // trim: şeffaflaşan kenar boşluğunu atar, logo ikon içinde daha büyük durur.
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels },
  })
    .trim({ threshold: 1 })
    .png()
    .toBuffer();
}

async function writeIcon(markBuffer, size, padding = ICON_PADDING_RATIO, outPath = null) {
  const inner = Math.round(size * (1 - padding * 2));

  const resizedMark = await sharp(markBuffer)
    .resize(inner, inner, { fit: "contain", background: "#00000000" })
    .png()
    .toBuffer();

  await sharp(brandGroundSvg(size))
    .composite([{ input: resizedMark, gravity: "center" }])
    .png()
    .toFile(outPath ?? path.join(ICON_DIR, `icon-${size}.png`));

  if (!outPath) {
    console.log(`icon-${size}.png yazıldı (${size}x${size}, açık marka zemini)`);
  }
}

async function main() {
  await mkdir(ICON_DIR, { recursive: true });

  const markBuffer = await makeTransparentMark();

  await sharp(markBuffer)
    .resize(512, 512, { fit: "contain", background: "#00000000" })
    .png()
    .toFile(MARK_OUT);
  console.log("logo-mark.png yazıldı (512x512, şeffaf zemin)");

  await writeIcon(markBuffer, 192);
  await writeIcon(markBuffer, 512);

  /*
    Favicon boyutları.

    16 ve 32 px'te dolgu oranı büyük ikonlardakiyle aynı olsaydı mark
    okunmayacak kadar küçülüyordu; bu boyutlarda kenar payı yarıya
    indiriliyor.
  */
  await writeIcon(markBuffer, 32, ICON_PADDING_RATIO / 2);
  await writeIcon(markBuffer, 16, ICON_PADDING_RATIO / 2);
  await writeIcon(markBuffer, 180, ICON_PADDING_RATIO, APPLE_OUT);
  console.log('apple-touch-icon.png yazıldı (180x180)');

  /*
    favicon.ico: 32 ve 16 px PNG'leri tek ICO'ya paketliyor.

    sharp ICO yazamıyor, bu yüzden başlık elle kuruluyor — biçim
    basit ve tek bağımlılık eklemekten ucuz. ICO, PNG gövdeleri
    gömmeye izin veriyor (Vista+), yani BMP'ye çevirmeye gerek yok.
  */
  const ico32 = await readFile(path.join(ICON_DIR, 'icon-32.png'));
  const ico16 = await readFile(path.join(ICON_DIR, 'icon-16.png'));
  await writeFile(path.join(ROOT, 'public', 'favicon.ico'), buildIco([
    { size: 32, data: ico32 },
    { size: 16, data: ico16 },
  ]));
  console.log('favicon.ico yazıldı (32 + 16)');
}

/** Birden çok PNG'yi tek ICO kabına paketler. */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // ayrılmış
  header.writeUInt16LE(1, 2); // tip: ikon
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;

  for (const img of images) {
    const entry = Buffer.alloc(16);
    // 256 px ICO'da 0 olarak yazılır; bizim boyutlarımız küçük.
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 0);
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 1);
    entry.writeUInt8(0, 2); // palet yok
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4); // renk düzlemi
    entry.writeUInt16LE(32, 6); // bit derinliği
    entry.writeUInt32LE(img.data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += img.data.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

main().catch((error) => {
  console.error("İkon üretimi başarısız:", error);
  process.exitCode = 1;
});
