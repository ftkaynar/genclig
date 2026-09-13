# GençLİG

Gençlerin şehir ve mahalle görevlerini oyunlaştıran platform.

Tek bir Next.js projesi, üç yüz:

- `/` — kullanıcı PWA'sı
- `/panel` — belediye paneli
- `/admin` — süper admin

Backend Supabase (Postgres, Auth, Storage, RLS, Edge Functions), deploy Vercel.

## Gereksinimler

- Node.js 20.9+ (geliştirmede kullanılan: 24.18.0)
- pnpm 12.4.1

## Kurulum

```bash
pnpm install
cp .env.example .env.local   # değerleri Supabase Project Settings > API'den doldur
pnpm dev
```

Env değişkenleri tanımlı olmasa da uygulama ayağa kalkar; `/api/health` bu durumda
`{"ok":true,"supabase":"missing"}` döner.

## Betikler

- `pnpm dev` — geliştirme sunucusu
- `pnpm build` — üretim derlemesi
- `pnpm start` — derlenmiş uygulamayı çalıştırır
- `pnpm check:types` — `tsc --noEmit`, tip kontrolü
- `pnpm check:lint` — `eslint .`, lint
- `pnpm check:boot` — `next build`, Vercel ile aynı derleme kontrolü
- `pnpm check:all` — üçünü sırayla koşar (CI de bunu koşar)

### `check:lint` neden `eslint .` değil

ESLint 9'un ignore desenleri (`globalIgnores([".next/**"])`) proje yolu ASCII dışı
karakter içerdiğinde sessizce çalışmıyor; bu klasörün adı `GençLİG` olduğu için
`eslint .` derleme çıktısını (`.next/`) de lintliyor ve binlerce sahte hata veriyor.
Aynı config ASCII bir yola kopyalandığında sorunsuz çalışıyor — sorun config'te
değil, yolda.

Bu yüzden lint "neyi atla" yerine "neyi lintle" ile tanımlandı: `src` ve kök
seviyedeki `*.ts` / `*.mjs` config dosyaları. Yeni bir üst düzey kaynak klasörü
eklenirse bu betiğe de eklenmelidir.

## Ortam değişkenleri

`.env.example` dosyasına bakın. Service role key gibi gizli değerler repoya ve
client bundle'a girmez.

## Çalışma kuralları

Proje kuralları [`AGENTS.md`](AGENTS.md) ve [`.agent/rules/genclig-kurallar.md`](.agent/rules/genclig-kurallar.md) dosyalarında.
