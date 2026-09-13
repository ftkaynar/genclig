# GençLİG

Gençlerin şehir ve mahalle görevlerini oyunlaştıran platform.

Tek bir Next.js projesi, üç yüz:

- `/` — kullanıcı PWA'sı
- `/panel` — belediye paneli
- `/admin` — süper admin

Backend Supabase (Postgres, Auth, Storage, RLS, Edge Functions), deploy Vercel.

## Gereksinimler

- Node.js 24 — sürüm `.node-version` ile sabitlenmiştir, CI de bu sürümü kullanır.
  `package.json` içindeki `engines` alanı (`>=20.9.0`) Vercel'in kabul ettiği alt
  sınırı belirtir; ikisi bilerek ayrıdır.
- pnpm 12.4.1
- Docker — yalnızca yerel Supabase için gerekir (aşağıya bakın).

## Kurulum

```bash
pnpm install
cp .env.example .env.local   # değerleri Supabase Project Settings > API'den doldur
pnpm dev
```

Env değişkenleri tanımlı olmasa da uygulama ayağa kalkar; `/api/health` bu durumda
`{"ok":true,"supabase":"missing"}` döner.

## Yerel geliştirme

Yerel Supabase, Docker üzerinde çalışan bir Postgres + Auth + Storage + Studio
yığınıdır. Docker Desktop'ın açık olması gerekir.

```bash
pnpm db:start   # yığını ayağa kaldırır, ilk çalıştırmada imajları indirir
pnpm db:reset   # veritabanını sıfırlar ve supabase/migrations'ı baştan uygular
pnpm db:stop    # container'ları durdurur
```

`pnpm db:start` çıktısındaki `API URL` ve `anon key` değerleri `.env.local`
dosyasına yazılırsa uygulama buluta değil yerel yığına bağlanır.

Varsayılan portlar `supabase/config.toml` içinde tanımlıdır: API 54321,
veritabanı 54322, Studio 54323.

`pnpm db:reset` migration'ları sıfırdan uygular; bu yüzden şema değişiklikleri
her zaman `supabase/migrations` altında dosya olarak tutulur, elle çalıştırılan
SQL ile değil.

## Betikler

- `pnpm dev` — geliştirme sunucusu
- `pnpm build` — üretim derlemesi
- `pnpm start` — derlenmiş uygulamayı çalıştırır
- `pnpm check:types` — `tsc --noEmit`, tip kontrolü
- `pnpm check:lint` — `eslint .`, lint
- `pnpm check:boot` — `next build`, Vercel ile aynı derleme kontrolü
- `pnpm check:all` — üçünü sırayla koşar (CI de bunu koşar)
- `pnpm db:start` / `pnpm db:reset` / `pnpm db:stop` — yerel Supabase yığını

### `check:lint` kapsamı hakkında bir not

Bir dönem bu betik `eslint src "*.ts" "*.mjs"` şeklinde, yani "neyi atla" yerine
"neyi lintle" diyerek tanımlıydı. Sebebi ESLint 9'un ignore desenlerinin
(`globalIgnores([".next/**"])`) proje yolu ASCII dışı karakter içerdiğinde
sessizce çalışmamasıydı; klasör adı `GençLİG` olduğu için `eslint .` derleme
çıktısını da lintleyip binlerce sahte hata veriyordu.

Klasör `genclig` olarak yeniden adlandırıldıktan sonra ölçüldü: `eslint .` 12
dosya lintliyor, `.next` altından hiçbir dosyaya dokunmuyor. Bu yüzden betik
`eslint .` haline döndürüldü ve yeni bir üst düzey klasör eklendiğinde betiği
güncelleme zorunluluğu ortadan kalktı.

## Ortam değişkenleri

`.env.example` dosyasına bakın. Service role key gibi gizli değerler repoya ve
client bundle'a girmez.

## Çalışma kuralları

Proje kuralları [`AGENTS.md`](AGENTS.md) ve [`.agent/rules/genclig-kurallar.md`](.agent/rules/genclig-kurallar.md) dosyalarında.
