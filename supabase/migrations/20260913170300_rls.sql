-- RLS: yetki kontrolü veritabanında. Client'ta yetki kararı verilmez
-- (bkz. AGENTS.md madde 10). Bu dosya tüm tablolarda satır düzeyi
-- güvenliği açar ve politikaları tanımlar.

-- ---------------------------------------------------------------------------
-- Yardımcı fonksiyonlar
-- ---------------------------------------------------------------------------

-- security definer olmak zorunda: politikalar user_roles'u okuyacak, ama
-- user_roles'un kendi politikası da bu fonksiyonu kullanıyor. Fonksiyon
-- çağıranın yetkisiyle koşsaydı sonsuz özyineleme oluşurdu.
-- stable: aynı sorgu içinde tekrar tekrar çağrılınca yeniden hesaplanmaz.
-- search_path = '' ve tam nitelikli isimler: arama yolunu değiştirerek
-- sahte bir user_roles tablosu gösterme saldırısını kapatır.
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = 'super_admin'
  );
$$;

-- Belirli bir belediyede, verilen rollerden birine sahip mi?
create or replace function public.has_municipality_role(m_id uuid, roles text[])
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and municipality_id = m_id
      and role = any(roles)
  );
$$;

-- Bu fonksiyonlar RLS'i atlayarak user_roles okuduğu için çalıştırma yetkisi
-- açıkça verilir; gövdeleri yalnızca çağıranın kendi rollerine bakar.
grant execute on function public.is_super_admin() to anon, authenticated;
grant execute on function public.has_municipality_role(uuid, text[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profil değişmezleri
-- ---------------------------------------------------------------------------

-- id değişimi RLS tarafından zaten engelleniyor (with check id = auth.uid()),
-- bu tetikleyici ikinci savunma katmanı. created_at ise sessizce eski değerine
-- döndürülür: client yanlışlıkla tüm satırı geri gönderdiğinde update'in
-- patlaması yerine alanın korunması tercih edildi.
create or replace function public.profiles_guard_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'Profil kimliği değiştirilemez.';
  end if;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger profiles_guard_immutable_trg
  before update on public.profiles
  for each row execute function public.profiles_guard_immutable();

-- ---------------------------------------------------------------------------
-- RLS'i aç
-- ---------------------------------------------------------------------------

alter table public.provinces enable row level security;
alter table public.districts enable row level security;
alter table public.neighborhoods enable row level security;
alter table public.municipalities enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

-- ---------------------------------------------------------------------------
-- Referans veri: herkes okur, yalnızca süper admin yazar
-- ---------------------------------------------------------------------------

create policy provinces_select_public on public.provinces
  for select to anon, authenticated using (true);
create policy provinces_insert_super on public.provinces
  for insert to authenticated with check (public.is_super_admin());
create policy provinces_update_super on public.provinces
  for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy provinces_delete_super on public.provinces
  for delete to authenticated using (public.is_super_admin());

create policy districts_select_public on public.districts
  for select to anon, authenticated using (true);
create policy districts_insert_super on public.districts
  for insert to authenticated with check (public.is_super_admin());
create policy districts_update_super on public.districts
  for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy districts_delete_super on public.districts
  for delete to authenticated using (public.is_super_admin());

create policy neighborhoods_select_public on public.neighborhoods
  for select to anon, authenticated using (true);
create policy neighborhoods_insert_super on public.neighborhoods
  for insert to authenticated with check (public.is_super_admin());
create policy neighborhoods_update_super on public.neighborhoods
  for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy neighborhoods_delete_super on public.neighborhoods
  for delete to authenticated using (public.is_super_admin());

create policy municipalities_select_public on public.municipalities
  for select to anon, authenticated using (true);
create policy municipalities_insert_super on public.municipalities
  for insert to authenticated with check (public.is_super_admin());
create policy municipalities_update_super on public.municipalities
  for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy municipalities_delete_super on public.municipalities
  for delete to authenticated using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- profiles: yalnızca kendi satırı
-- ---------------------------------------------------------------------------

-- Başkasının profilini görmek bu dilimde hiç kimseye açılmadı. Herkese açık
-- profil görünürlüğü (visibility alanı) ayrı bir dilimde, kasıtlı olarak
-- eklenecek; varsayılanın kapalı olması gençlerle çalışan bir üründe
-- gerekli başlangıç noktası.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- INSERT ve DELETE politikası bilerek yok: profil satırı yalnızca
-- handle_new_user tetikleyicisinden açılır, silme auth.users cascade'i ile olur.

-- ---------------------------------------------------------------------------
-- user_roles: kendi rollerini görür, yazma yalnızca süper admin
-- ---------------------------------------------------------------------------

create policy user_roles_select_own on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()));
create policy user_roles_insert_super on public.user_roles
  for insert to authenticated with check (public.is_super_admin());
create policy user_roles_update_super on public.user_roles
  for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy user_roles_delete_super on public.user_roles
  for delete to authenticated using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Tablo yetkileri
-- ---------------------------------------------------------------------------

-- RLS politikası tek başına yetmez: rolün tablo üzerinde GRANT'i de olmalı.
-- Yetkiler açıkça yazıldı, çünkü otomatik yetkilendirme davranışı proje
-- ayarına bağlı ve sessizce değişebilir.
grant select on public.provinces, public.districts, public.neighborhoods, public.municipalities
  to anon, authenticated;
grant insert, update, delete on public.provinces, public.districts, public.neighborhoods, public.municipalities
  to authenticated;

-- profiles: insert/delete yetkisi bilerek verilmedi.
grant select, update on public.profiles to authenticated;

grant select, insert, update, delete on public.user_roles to authenticated;
