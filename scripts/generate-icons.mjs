/**
 * Marka görsellerini public/brand/logo.png kaynağından üretir.
 *
 * Üretilenler:
 *   public/brand/logo-mark.png  — zemini şeffaflaştırılmış, kırpılmış logo
 *   public/icons/icon-192.png   — koyu lacivert zemin üzerine ortalanmış mark
 *   public/icons/icon-512.png   — aynısı, 512 px
 *
 * Neden tek seferlik script, build adımı değil: logo yılda birkaç kez değişir,
 * her derlemede sharp çalıştırmak build süresine kalıcı yük bindirirdi. Çıktılar
 * repoda tutuluyor, script yalnızca logo değişince elle koşuluyor.
 *
 * Kaynak logo opak (kirli beyaz) bir zemine sahip. İkonlar koyu lacivert zemin
 * istediği için zemin şeffaflaştırılıyor; aksi halde koyu ikonun ortasında
 * beyaz bir kare kalırdı.
 *
 * Koşma: pnpm brand:icons
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "public", "brand", "logo.png");
const MARK_OUT = path.join(ROOT, "public", "brand", "logo-mark.png");
const ICON_DIR = path.join(ROOT, "public", "icons");

/** Marka koyu zemini (globals.css --surface-bg, koyu tema). */
const ICON_BACKGROUND = "#0B1220";

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

async function writeIcon(markBuffer, size) {
  const inner = Math.round(size * (1 - ICON_PADDING_RATIO * 2));

  const resizedMark = await sharp(markBuffer)
    .resize(inner, inner, { fit: "contain", background: "#00000000" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: ICON_BACKGROUND,
    },
  })
    .composite([{ input: resizedMark, gravity: "center" }])
    .png()
    .toFile(path.join(ICON_DIR, `icon-${size}.png`));

  console.log(`icon-${size}.png yazıldı (${size}x${size}, zemin ${ICON_BACKGROUND})`);
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
}

main().catch((error) => {
  console.error("İkon üretimi başarısız:", error);
  process.exitCode = 1;
});
