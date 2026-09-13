# İşletim Notları

Bulut ortamını (Supabase projesi `dfttglwicxopwejakitk`) elle yapılandırmak için
gereken adımlar. Buradaki SQL'ler **Supabase Studio > SQL Editor**'de çalıştırılır.

---

## 1. İlk süper admin atama

Uygulamada hiçbir yerden süper admin atanamaz — yumurta-tavuk sorunu: rol vermek
için süper admin olmak gerekiyor. İlki veritabanından elle verilir.

Önce hesabı aç (canlı sitede `/kayit`), sonra:

```sql
-- Kullanıcının id'sini bul
select id, email from auth.users where email = 'senin@epostan.com';

-- Süper admin rolünü ver (municipality_id null = platform geneli)
insert into public.user_roles (user_id, role, municipality_id)
values ('BURAYA_USER_ID', 'super_admin', null)
on conflict do nothing;
```

Bundan sonra `/admin` açılır ve kalan rol atamaları oradan yapılabilir.

---

## 2. Belediye ekleme ve personel atama

Süper admin girişi olduktan sonra `/admin/belediyeler` ve `/admin/kullanicilar`
üzerinden yapılabilir. SQL karşılığı:

```sql
-- Belediye
insert into public.municipalities (name, slug, level, province_id, district_id, status)
select 'Kadıköy Belediyesi', 'kadikoy', 'district', 34, d.id, 'active'
from public.districts d
where d.province_id = 34 and d.name = 'Kadıköy'
on conflict do nothing;

-- Personel ataması (kullanıcı önce kayıt olmalı)
insert into public.user_roles (user_id, role, municipality_id)
values (
  (select id from auth.users where email = 'personel@belediye.gov.tr'),
  'municipality_operator',                 -- veya 'municipality_admin'
  (select id from public.municipalities where slug = 'kadikoy')
)
on conflict do nothing;
```

Roller: `municipality_admin`, `municipality_operator`, `moderator`, `super_admin`.
Belediye rollerinde `municipality_id` zorunlu; `super_admin`'de `null`.

---

## 3. E-posta gönderimi — mevcut sınır

**Bulutta kullanıcı testi şu an sınırlı.** Supabase'in yerleşik SMTP'si saatte
yalnızca birkaç e-posta gönderiyor; art arda kayıt denemesi
`429 over_email_send_rate_limit` ile reddediliyor. Bu bir proje ayarı değil,
yerleşik gönderimin kotası.

Gerçek kullanıcı akışı için kendi SMTP sağlayıcın bağlanmalı:
Supabase Studio > Project Settings > Authentication > SMTP Settings.

Ayrıca **yönlendirme adresleri henüz ayarlı değil**:

```
site_url       : http://localhost:3000     <- canlı adres olmalı
uri_allow_list : (boş)
```

Bu haliyle canlıda kayıt olan kullanıcının doğrulama bağlantısı `localhost`'a
döner. Düzeltmesi Studio > Authentication > URL Configuration:

- Site URL: `https://genclig.vercel.app`
- Redirect URLs: `https://genclig.vercel.app/**`

Yerelde aynı ayarlar `supabase/config.toml` içinde zaten yapılandırılmış durumda.

---

## 4. Yerel geliştirme veritabanını sıfırlama

```bash
pnpm db:start      # Docker yığınını ayağa kaldırır
pnpm db:reset      # tüm migration'ları sıfırdan uygular
pnpm db:stop
```

RLS davranışını sınamak için:

```bash
docker exec -i supabase_db_genclig psql -X -v ON_ERROR_STOP=0 \
  -U postgres -d postgres < supabase/tests/rls_isolation.sql
```

Bu betik **yalnızca yerelde** koşar; bulutta çalıştırılmamalıdır (dosyanın
başındaki uyarıya bakın).

---

## 5. Bulut migration akışı

```bash
export SUPABASE_ACCESS_TOKEN='...'
export SUPABASE_DB_PASSWORD='...'

pnpm dlx --allow-build=esbuild supabase link --project-ref dfttglwicxopwejakitk
pnpm dlx --allow-build=esbuild supabase db push --dry-run   # önce ne gideceğini gör
pnpm dlx --allow-build=esbuild supabase db push
```

`--allow-build=esbuild` gerekiyor: pnpm, Vercel/Supabase CLI'ın bağımlılığı olan
esbuild'in kurulum betiğini varsayılan olarak engelliyor.
