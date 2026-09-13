-- Kiracı (tenant) tablosu: belediyeler.
-- Platform çok kiracılı. Her görev, puan ve operatör hesabı bir belediyeye
-- bağlanacak; bu tablo o bağın kökü.

create table public.municipalities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- slug URL'de ve panel adresinde görünür, bu yüzden tekil.
  slug text not null unique,
  level text not null check (level in ('metropolitan', 'district', 'town')),
  province_id smallint not null references public.provinces (id) on delete restrict,
  -- Büyükşehir belediyesinin ilçesi yoktur; bu yüzden district_id null olabilir.
  district_id bigint references public.districts (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'passive')),
  -- settings: kiracıya özel ayarlar (tema, görev limitleri vb.). Şemayı her
  -- yeni ayar için değiştirmemek adına jsonb. İş mantığına giren alanlar
  -- buradan çıkarılıp gerçek sütun yapılacak.
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Kiracıya göre listeleme sık olacağı için il bazlı filtreye indeks.
create index municipalities_province_id_idx on public.municipalities (province_id);
