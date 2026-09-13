-- Görev motoru: kategori, görev tanımı, dönem mantığı, teslim ve doğrulama kaydı.
-- Puan/coin YAZIMI bu dilimde yok; ödül değerleri yalnızca görev tanımında duruyor.

-- ---------------------------------------------------------------------------
-- Kategoriler
-- ---------------------------------------------------------------------------

create table public.task_categories (
  id smallint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  icon text,
  sort smallint not null default 0
);

-- ---------------------------------------------------------------------------
-- Görevler
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  -- NULL ise platform geneli (global) görev, doluysa o belediyenin görevi.
  municipality_id uuid references public.municipalities (id) on delete cascade,
  category_id smallint not null references public.task_categories (id) on delete restrict,
  type text not null check (type in ('continuous', 'instant', 'daily', 'weekly', 'monthly')),
  title text not null,
  description text not null,
  instructions text,
  image_url text,
  xp integer not null check (xp >= 0),
  coin integer not null check (coin >= 0),
  -- MVP davranışı photo/gps/photo_gps ile sınırlı. Diğer değerler şemada
  -- taşınıyor ama bu dilimde hiçbir davranış eklemiyor; ileride enum'a
  -- dokunmadan uygulama tarafında açılabilsinler diye baştan yazıldı.
  verification text not null check (
    verification in ('photo', 'gps', 'photo_gps', 'qr', 'quiz', 'health', 'manual')
  ),
  -- Görev detay ekranındaki "Zorluk" satırının kaynağı (bkz. docs/design).
  -- Varsayılan 'easy': mevcut görevlerin çoğu kolay ve alan sonradan
  -- eklendiği için, değer girilmeyen kayıtların tanımsız kalması istenmedi.
  difficulty text not null default 'easy' check (difficulty in ('easy', 'medium', 'hard')),
  lat double precision,
  lng double precision,
  radius_m integer,
  starts_at timestamptz,
  -- instant görevlerde geri sayımın dayanağı. Zorunluluk uygulama katmanında;
  -- veritabanı seviyesinde zorlanmadı çünkü taslak (draft) görev kaydedilirken
  -- bitiş zamanı henüz girilmemiş olabiliyor.
  ends_at timestamptz,
  capacity integer,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_status_idx on public.tasks (status);
create index tasks_municipality_id_idx on public.tasks (municipality_id);
create index tasks_category_id_idx on public.tasks (category_id);
create index tasks_type_idx on public.tasks (type);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Dönem anahtarı
-- ---------------------------------------------------------------------------

/*
  Bir görevin "hangi turda" yapıldığını anlatan metin.

  continuous ve instant görevlerde tur kavramı yok: ikisi de ömür boyu bir kez
  yapılır, o yüzden sabit 'once'. daily/weekly/monthly'de anahtar takvimden
  türetiliyor ve (task, user, period_key) tekilliğiyle birleşince "dönemde bir
  kez" kuralı veritabanı garantisine dönüşüyor.

  Neden Europe/Istanbul: sunucu UTC çalışıyor. Yerel saatle 00:30'da yapılan
  günlük görev UTC'de bir önceki güne düşüyordu; kullanıcı gece yarısından
  sonra görevi tekrar açık görüyordu. Tarih sınırı kullanıcının gördüğü
  takvimle aynı olmalı.

  Denenen ve elenen alternatif: period_key'i uygulama katmanında üretmek.
  Elendi, çünkü teslim satırını client gönderiyor; anahtarı da o üretseydi
  farklı bir değer yollayarak aynı dönemde ikinci kez görev tamamlayabilirdi.
*/
create or replace function public.task_period_key(task_type text, ts timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select case task_type
    when 'daily' then to_char(ts at time zone 'Europe/Istanbul', 'YYYY-MM-DD')
    when 'weekly' then to_char(ts at time zone 'Europe/Istanbul', 'IYYY"W"IW')
    when 'monthly' then to_char(ts at time zone 'Europe/Istanbul', 'YYYY-MM')
    else 'once'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Teslimler
-- ---------------------------------------------------------------------------

create table public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Trigger tarafından doldurulur; client'ın gönderdiği değer yok sayılır.
  period_key text not null default 'once',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  photo_path text,
  submitted_lat double precision,
  submitted_lng double precision,
  distance_m double precision,
  note text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now(),

  -- "Dönemde bir kez" kuralının veritabanı garantisi.
  constraint task_submissions_period_unique unique (task_id, user_id, period_key)
);

create index task_submissions_user_id_idx on public.task_submissions (user_id);
create index task_submissions_task_id_idx on public.task_submissions (task_id);
create index task_submissions_status_idx on public.task_submissions (status);
-- Storage politikası dosya yolundan teslim satırına gidiyor; o sorgu bu indeksi kullanır.
create index task_submissions_photo_path_idx on public.task_submissions (photo_path);

/*
  period_key'i sunucuda üretir ve client'tan geleni bilerek ezer.
  Bu satır olmadan tekillik kısıtı kandırılabilir: kullanıcı her seferinde
  farklı bir period_key göndererek aynı günün görevini defalarca teslim
  edebilirdi.
*/
create or replace function public.task_submissions_set_period_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t_type text;
begin
  select type into t_type from public.tasks where id = new.task_id;

  if t_type is null then
    raise exception 'Görev bulunamadı.';
  end if;

  new.period_key := public.task_period_key(t_type, now());
  return new;
end;
$$;

create trigger task_submissions_period_key_trg
  before insert on public.task_submissions
  for each row execute function public.task_submissions_set_period_key();

-- ---------------------------------------------------------------------------
-- Seed: kategoriler
-- ---------------------------------------------------------------------------

insert into public.task_categories (id, slug, name, icon, sort)
overriding system value
values
  (1, 'environment', 'Çevre', 'leaf', 10),
  (2, 'social', 'Sosyal', 'users', 20),
  (3, 'sports', 'Spor', 'activity', 30),
  (4, 'culture', 'Kültür', 'landmark', 40),
  (5, 'education', 'Eğitim', 'book-open', 50),
  (6, 'civic', 'Şehir Katılımı', 'megaphone', 60)
on conflict do nothing;

select setval(
  pg_get_serial_sequence('public.task_categories', 'id'),
  (select max(id) from public.task_categories)
);

-- ---------------------------------------------------------------------------
-- Seed: örnek global görevler
-- ---------------------------------------------------------------------------

-- Sabit uuid'ler kullanıldı: migration yeniden uygulandığında on conflict
-- çalışsın ve örnek görevler kopyalanmasın diye.
insert into public.tasks (
  id, municipality_id, category_id, type, title, description, instructions,
  xp, coin, verification, lat, lng, radius_m, starts_at, ends_at, capacity, status
)
values
  (
    '0000f1a5-0000-4000-8000-000000000001',
    null,
    (select id from public.task_categories where slug = 'civic'),
    'continuous',
    'Mahallendeki bir sorunu fotoğrafla',
    'Mahallende gördüğün bir altyapı veya çevre sorununu fotoğraflayıp bildir.',
    'Sorunu net gösteren tek bir fotoğraf çek. Kişilerin yüzü görünmesin.',
    50, 50, 'photo',
    null, null, null,
    null, null, null,
    'active'
  ),
  (
    '0000f1a5-0000-4000-8000-000000000002',
    null,
    (select id from public.task_categories where slug = 'sports'),
    'continuous',
    'Bir parkı ziyaret et',
    'Gülhane Parkı''na git ve konumunu doğrulat.',
    'Park sınırları içindeyken görevi tamamla; konum doğrulaması 150 metre yarıçapla yapılır.',
    80, 80, 'gps',
    -- Gülhane Parkı, Fatih/İstanbul.
    41.013400, 28.981200, 150,
    null, null, null,
    'active'
  ),
  (
    '0000f1a5-0000-4000-8000-000000000003',
    null,
    (select id from public.task_categories where slug = 'environment'),
    'instant',
    'Sahil temizliğine katıl',
    'Bu hafta sonu düzenlenen sahil temizliğine katıl ve katılımını belgele.',
    'Etkinlik alanında çekilmiş bir fotoğraf yükle. Konumun da doğrulanacak.',
    200, 200, 'photo_gps',
    40.986500, 29.025400, 300,
    now(), now() + interval '7 days', 100,
    'active'
  ),
  (
    '0000f1a5-0000-4000-8000-000000000004',
    null,
    (select id from public.task_categories where slug = 'sports'),
    'daily',
    'Parkta 7.500 adım at',
    'Sağlıklı bir yaşam için bugün parkta 7.500 adım at.',
    'Görevi park içindeyken tamamla.',
    50, 50, 'gps',
    41.013400, 28.981200, 200,
    null, null, null,
    'active'
  )
on conflict do nothing;

-- Şemanın taslak görevi gizlediğini sınayabilmek için bilerek draft bırakılan kayıt.
insert into public.tasks (
  id, municipality_id, category_id, type, title, description,
  xp, coin, verification, status
)
values
  (
    '0000f1a5-0000-4000-8000-0000000000d1',
    null,
    (select id from public.task_categories where slug = 'culture'),
    'continuous',
    'Taslak görev (yayında değil)',
    'Bu görev taslak durumunda; yalnızca süper admin görebilmeli.',
    10, 10, 'photo',
    'draft'
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.task_categories enable row level security;
alter table public.tasks enable row level security;
alter table public.task_submissions enable row level security;

-- Kategoriler: referans veri.
create policy task_categories_select_public on public.task_categories
  for select to anon, authenticated using (true);
create policy task_categories_insert_super on public.task_categories
  for insert to authenticated with check (public.is_super_admin());
create policy task_categories_update_super on public.task_categories
  for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy task_categories_delete_super on public.task_categories
  for delete to authenticated using (public.is_super_admin());

/*
  Görev okuma üç ayrı politikayla veriliyor; permissive politikalar OR'landığı
  için biri yetiyor. Tek bir politikada birleştirilseydi, yayındaki görevleri
  anon'a açan koşul ile personelin taslak görmesini sağlayan koşul aynı ifadede
  iç içe geçer ve okunması zorlaşırdı.
*/
create policy tasks_select_active on public.tasks
  for select to anon, authenticated using (status = 'active');

create policy tasks_select_staff on public.tasks
  for select to authenticated using (
    municipality_id is not null
    and public.has_municipality_role(
      municipality_id,
      array['municipality_admin', 'municipality_operator']
    )
  );

create policy tasks_select_super on public.tasks
  for select to authenticated using (public.is_super_admin());

/*
  Yazma: süper admin her şeyi, belediye personeli yalnızca kendi belediyesinin
  görevlerini. municipality_id null (global görev) durumunda ikinci koşul
  sağlanamadığı için global görev yazmak yalnızca süper adminde kalıyor.
*/
create policy tasks_insert_staff on public.tasks
  for insert to authenticated with check (
    public.is_super_admin()
    or (
      municipality_id is not null
      and public.has_municipality_role(
        municipality_id,
        array['municipality_admin', 'municipality_operator']
      )
    )
  );

-- using eski satıra, with check yeni satıra bakar. İkisi birlikte yazıldı;
-- yalnızca using olsaydı personel görevi başka bir belediyeye taşıyabilirdi.
create policy tasks_update_staff on public.tasks
  for update to authenticated
  using (
    public.is_super_admin()
    or (
      municipality_id is not null
      and public.has_municipality_role(
        municipality_id,
        array['municipality_admin', 'municipality_operator']
      )
    )
  )
  with check (
    public.is_super_admin()
    or (
      municipality_id is not null
      and public.has_municipality_role(
        municipality_id,
        array['municipality_admin', 'municipality_operator']
      )
    )
  );

create policy tasks_delete_super on public.tasks
  for delete to authenticated using (public.is_super_admin());

-- Teslimler: kullanıcı kendi satırları, personel kendi belediyesinin görevleri.
create policy task_submissions_select_own on public.task_submissions
  for select to authenticated using (user_id = (select auth.uid()));

create policy task_submissions_select_staff on public.task_submissions
  for select to authenticated using (
    exists (
      select 1
      from public.tasks t
      where t.id = task_submissions.task_id
        and t.municipality_id is not null
        and public.has_municipality_role(
          t.municipality_id,
          array['municipality_admin', 'municipality_operator']
        )
    )
  );

create policy task_submissions_select_super on public.task_submissions
  for select to authenticated using (public.is_super_admin());

/*
  Teslim açma: yalnızca kendi adına, yalnızca beklemede ve inceleme alanları
  boş. Bu üç koşul olmadan kullanıcı kendi teslimini onaylanmış olarak
  yazabilir ve ödülü hak etmeden alabilirdi.
*/
create policy task_submissions_insert_own on public.task_submissions
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and reject_reason is null
  );

-- UPDATE ve DELETE politikası bilerek yok: inceleme akışı sunucu tarafında,
-- ayrı bir dilimde eklenecek.

grant select on public.task_categories to anon, authenticated;
grant insert, update, delete on public.task_categories to authenticated;

grant select on public.tasks to anon, authenticated;
grant insert, update, delete on public.tasks to authenticated;

grant select, insert on public.task_submissions to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: görev kanıtı fotoğrafları
-- ---------------------------------------------------------------------------

-- Private bucket: dosyalara yalnızca imzalı URL veya politika üzerinden erişilir.
insert into storage.buckets (id, name, public)
values ('task-proofs', 'task-proofs', false)
on conflict (id) do nothing;

/*
  Dosya yolu düzeni: <user_id>/<dosya adı>.
  Politikalar ilk klasör adının kullanıcının kimliğiyle aynı olmasına bakıyor;
  bu yüzden yükleme yolunu uygulama bu düzende kurmak zorunda.
*/
create policy task_proofs_insert_own on storage.objects
  for insert to authenticated with check (
    bucket_id = 'task-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy task_proofs_select_own on storage.objects
  for select to authenticated using (
    bucket_id = 'task-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Personel ve süper admin, incelemek için kanıt fotoğrafını görebilmeli.
-- Bağ dosya yolundan teslim satırına kuruluyor; bucket içindeki başıboş bir
-- dosya bu politikayla kimseye açılmaz.
create policy task_proofs_select_staff on storage.objects
  for select to authenticated using (
    bucket_id = 'task-proofs'
    and exists (
      select 1
      from public.task_submissions s
      join public.tasks t on t.id = s.task_id
      where s.photo_path = storage.objects.name
        and (
          public.is_super_admin()
          or (
            t.municipality_id is not null
            and public.has_municipality_role(
              t.municipality_id,
              array['municipality_admin', 'municipality_operator']
            )
          )
        )
    )
  );
