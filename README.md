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
- `pnpm brand:icons` — logodan PWA ikonlarını üretir (bkz. Marka)

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

## Marka

Ana renkler: lacivert `#0E2A47`, teal `#0F6E7E`, ana yeşil `#17B890`, parlak
yeşil `#3DDC97` (imza rengi, yalnızca CTA'da). Yan renkler: coin sarısı
`#F5B301`, XP moru `#7C5CFC`. Durum renkleri: başarı `#17B890`, uyarı
`#F5A524`, hata `#E5484D`. Marka gradyanı lacivertten parlak yeşile gider ve
sayfada tek bir imza alanında kullanılır, yüzeylerin geneline yayılmaz.

Renkler `src/app/globals.css` içinde CSS değişkeni olarak duruyor ve Tailwind
`@theme inline` ile utility'lere bağlanıyor: `bg-surface`, `bg-card`,
`border-edge`, `text-ink`, `text-ink-muted`, `bg-cta`, `text-coin` gibi. Renk
değerini doğrudan sınıfa yazmak yerine bu token'lar kullanılır; aksi halde tema
değişiminde o öğe eski renginde kalır.

Tema varsayılanları segmente göre: kullanıcı PWA'sı (`/`) koyu, `/panel` ve
`/admin` açık. Kullanıcı tema butonuyla seçim yaparsa tercihi `localStorage`'a
yazılır ve her yerde varsayılanı ezer.

Logo küçük boyutlarda tek renk kullanılır; gradyanlı hali 24 pikselin altında
lekeye dönüşüyor. `public/brand/logo.png` kaynak dosyadır, opak zeminlidir.
`pnpm brand:icons` bundan zemini şeffaflaştırılmış `logo-mark.png` ile 192 ve
512 piksellik PWA ikonlarını üretir. Logo değişirse bu betik elle koşulur,
çıktılar repoda tutulur.

## Ortam değişkenleri

`.env.example` dosyasına bakın. Service role key gibi gizli değerler repoya ve
client bundle'a girmez.

## Çalışma kuralları

Proje kuralları [`AGENTS.md`](AGENTS.md) ve [`.agent/rules/genclig-kurallar.md`](.agent/rules/genclig-kurallar.md) dosyalarında.
