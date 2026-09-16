/*
  20 geçici görev kapak görseli üretir (art-01..art-20) + manifest.

  Geçici: proje sahibi anime tarzı gerçek görselleri sipariş edecek.
  Yerlerine AYNI ANAHTARLA kopyalandığında kod hiç değişmeyecek — bu
  yüzden ad, en-boy oranı ve manifest yapısı şimdiden sabitlendi.

  SVG seçildi: 20 dosya toplam ~80 KB. Aynı yer tutucuları raster
  üretmek yarım megabayt ölü ağırlık demekti. Gerçek görseller WEBP
  olarak gelecek; manifest uzantıyı da taşıyor, bu yüzden geçiş
  manifest'i yeniden yazmaktan ibaret.

  Çalıştırma: node scripts/generate-task-art.mjs
*/
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Depo köküne göre: betik nereden çağrılırsa çağrılsın aynı yere yazsın.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "public", "task-art");
mkdirSync(DIR, { recursive: true });

// Palet v2'den: her görsel iki markalı renk arası geçiş.
const PAIRS = [
  ["#1b9e77", "#22b8cf", "Çevre · ağaç dikimi"],
  ["#2f6fed", "#5b4bd6", "Toplum · dayanışma"],
  ["#d6336c", "#2f6fed", "Spor · koşu"],
  ["#5b4bd6", "#2f6fed", "Kültür · sahne"],
  ["#f2b705", "#d6336c", "Eğitim · kitap"],
  ["#22b8cf", "#5b4bd6", "Yurttaşlık · meydan"],
  ["#1b9e77", "#f2b705", "Geri dönüşüm"],
  ["#d6336c", "#f2b705", "Bağış"],
  ["#2f6fed", "#22b8cf", "Su ve tasarruf"],
  ["#5b4bd6", "#d6336c", "Müzik"],
  ["#1b9e77", "#2f6fed", "Bisiklet"],
  ["#f2b705", "#1b9e77", "Tarım · fide"],
  ["#22b8cf", "#1b9e77", "Sahil temizliği"],
  ["#d6336c", "#5b4bd6", "Tiyatro"],
  ["#2f6fed", "#f2b705", "Kütüphane"],
  ["#5b4bd6", "#22b8cf", "Kodlama"],
  ["#1b9e77", "#d6336c", "Hayvan barınağı"],
  ["#f2b705", "#2f6fed", "Yaşlı ziyareti"],
  ["#22b8cf", "#d6336c", "Festival"],
  ["#5b4bd6", "#1b9e77", "Doğa yürüyüşü"],
];

// 3:4 — görev kartının en-boy oranıyla aynı, kırpılma olmasın.
const W = 600;
const H = 800;

const items = [];

PAIRS.forEach(([from, to, hint], i) => {
  const key = `art-${String(i + 1).padStart(2, "0")}`;

  // Hafif diyagonal doku: düz gradyan kartta "boş" görünüyordu.
  const stripes = Array.from({ length: 9 }, (_, k) => {
    const x = -200 + k * 110;
    const h = H + 240;
    return `<rect x="${x}" y="-120" width="34" height="${h}" transform="rotate(18 ${x} 0)"/>`;
  }).join("");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ` +
    `width="${W}" height="${H}">` +
    `<defs>` +
    `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${from}"/>` +
    `<stop offset="1" stop-color="${to}"/>` +
    `</linearGradient>` +
    `<radialGradient id="h" cx="0.3" cy="0.22" r="0.75">` +
    `<stop offset="0" stop-color="#ffffff" stop-opacity="0.34"/>` +
    `<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>` +
    `</radialGradient>` +
    `</defs>` +
    `<title>${hint}</title>` +
    `<rect width="${W}" height="${H}" fill="url(#g)"/>` +
    `<g opacity="0.07" fill="#ffffff">${stripes}</g>` +
    `<rect width="${W}" height="${H}" fill="url(#h)"/>` +
    `</svg>`;

  writeFileSync(join(DIR, `${key}.svg`), svg, "utf8");
  items.push({ key, file: `${key}.svg`, hint });
});

const manifest = {
  note:
    "Görev kapak görselleri. Gerçek görseller aynı anahtarla değiştirilecek; " +
    "'file' alanı uzantıyı taşıdığı için kod değişmeden WEBP'ye geçilebilir.",
  width: W,
  height: H,
  items,
};

writeFileSync(
  join(DIR, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(`${items.length} görsel + manifest yazıldı -> public/task-art/`);
