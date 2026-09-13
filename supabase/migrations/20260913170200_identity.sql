-- Kimlik: profil ve roller.
-- auth.users Supabase'in yönettiği tablodur; uygulama verisi oraya yazılmaz,
-- public.profiles üzerinden taşınır.

-- citext: kullanıcı adı büyük/küçük harf duyarsız tekil olmalı ("Ayse" ile
-- "ayse" aynı kişiyi işaret eder). Denenen ve elenen alternatif: text + lower()
-- üzerinde unique index; citext ile aynı sonucu veriyor ama her sorguda
-- lower() yazmayı gerektirdiği için uygulama tarafında hata payı bırakıyordu.
create extension if not exists citext with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Kayıt anında boş; onboarding akışında doldurulur.
  username extensions.citext unique,
  display_name text,
  avatar_url text,
  birth_date date,
  gender text,
  province_id smallint references public.provinces (id) on delete set null,
  district_id bigint references public.districts (id) on delete set null,
  neighborhood_id bigint references public.neighborhoods (id) on delete set null,
  municipality_id uuid references public.municipalities (id) on delete set null,
  -- visibility: hangi alanın kime görüneceği. Gençlerle çalışıldığı için
  -- görünürlük varsayılanı kapalı kabul edilir; boş jsonb "hiçbiri açık değil"
  -- anlamına gelir.
  visibility jsonb not null default '{}'::jsonb,
  -- 18 yaş altı kullanıcıda veli onayının alındığı an.
  guardian_consent_at timestamptz,
  created_at timestamptz not null default now()
);

create index profiles_municipality_id_idx on public.profiles (municipality_id);
create index profiles_neighborhood_id_idx on public.profiles (neighborhood_id);

create table public.user_roles (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in (
    'super_admin', 'municipality_admin', 'municipality_operator', 'moderator', 'user'
  )),
  -- super_admin belediyeden bağımsızdır, o yüzden null olabilir.
  municipality_id uuid references public.municipalities (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- nulls not distinct: municipality_id null iken de tekillik istiyoruz.
  -- Varsayılan davranışta iki null farklı sayılır ve aynı kullanıcıya
  -- super_admin rolü defalarca eklenebilirdi.
  constraint user_roles_unique unique nulls not distinct (user_id, role, municipality_id)
);

create index user_roles_user_id_idx on public.user_roles (user_id);
create index user_roles_municipality_id_idx on public.user_roles (municipality_id);

-- Yeni kullanıcı kaydolduğunda profil satırını otomatik açar.
-- security definer: auth.users üzerindeki tetikleyici, profiles'a yazma
-- yetkisi olmayan bir rol adına çalışabilir; tablo sahibi yetkisiyle koşması
-- gerekiyor. search_path boşaltıldı ve tüm isimler tam nitelikli yazıldı;
-- aksi halde arama yolunu değiştirebilen bir çağrı fonksiyonu kandırabilir.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
