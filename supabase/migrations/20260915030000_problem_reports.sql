-- Şehir bildirimleri: sorun, öneri ve proje.
--
-- Görev akışından ayrı bir domain: görevi platform tanımlar ve kullanıcı
-- yapar; bildirimi kullanıcı başlatır ve belediye işler. Ortak olan tek şey
-- puan ekonomisi.

create table public.problem_categories (
  id smallint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  sort smallint not null default 0
);

insert into public.problem_categories (slug, name, sort)
values
  ('waste', 'Çöp ve atık', 10),
  ('sidewalk', 'Kaldırım', 20),
  ('lighting', 'Aydınlatma', 30),
  ('park', 'Park ve yeşil alan', 40),
  ('traffic', 'Trafik', 50),
  ('water', 'Su ve kanalizasyon', 60),
  ('safety', 'Güvenlik', 70),
  ('accessibility', 'Engelli erişimi', 80),
  ('other', 'Diğer', 999)
on conflict do nothing;

create table public.problem_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  /*
    Raporun düşeceği belediye, gönderim anında kullanıcının profil ilçesinden
    türetiliyor ve sonradan değişmiyor. Neden kopyalanıyor: kullanıcı taşınıp
    profilini güncellediğinde eski raporu yeni belediyenin kuyruğuna düşmemeli.
  */
  municipality_id uuid references public.municipalities (id) on delete set null,
  category_id smallint not null references public.problem_categories (id) on delete restrict,
  kind text not null check (kind in ('problem', 'oneri', 'proje')),
  title text not null,
  description text not null,
  photo_path text,
  lat double precision,
  lng double precision,
  address_text text,
  status text not null default 'new' check (
    status in ('new', 'reviewing', 'in_progress', 'resolved', 'rejected')
  ),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index problem_reports_user_idx on public.problem_reports (user_id, created_at desc);
create index problem_reports_municipality_idx on public.problem_reports (municipality_id, status);

create table public.problem_status_history (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.problem_reports (id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index problem_status_history_report_idx
  on public.problem_status_history (report_id, created_at);

-- Puan bağı: bildirim gönderme ve çözülme ödülleri tek sefer.
alter table public.xp_transactions
  add column problem_id uuid references public.problem_reports (id) on delete set null;
alter table public.coin_transactions
  add column problem_id uuid references public.problem_reports (id) on delete set null;

alter table public.xp_transactions drop constraint xp_transactions_reason_check;
alter table public.xp_transactions add constraint xp_transactions_reason_check
  check (reason in ('task', 'badge', 'adjustment', 'problem_report', 'problem_resolved'));

alter table public.coin_transactions drop constraint coin_transactions_reason_check;
alter table public.coin_transactions add constraint coin_transactions_reason_check
  check (reason in ('task', 'badge', 'reward_spend', 'adjustment', 'problem_report', 'problem_resolved'));

create unique index xp_transactions_problem_unique
  on public.xp_transactions (problem_id, reason)
  where reason in ('problem_report', 'problem_resolved') and problem_id is not null;

create unique index coin_transactions_problem_unique
  on public.coin_transactions (problem_id, reason)
  where reason in ('problem_report', 'problem_resolved') and problem_id is not null;

-- Bildirim fotoğrafları ayrı bucket: görev kanıtından farklı erişim kuralı
-- olabilir ve karışmasınlar.
insert into storage.buckets (id, name, public)
values ('problem-photos', 'problem-photos', false)
on conflict (id) do nothing;

create policy problem_photos_insert_own on storage.objects
  for insert to authenticated with check (
    bucket_id = 'problem-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy problem_photos_select_own on storage.objects
  for select to authenticated using (
    bucket_id = 'problem-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Personel, işlemek zorunda olduğu raporun fotoğrafını görebilmeli.
create policy problem_photos_select_staff on storage.objects
  for select to authenticated using (
    bucket_id = 'problem-photos'
    and exists (
      select 1
      from public.problem_reports r
      where r.photo_path = storage.objects.name
        and (
          public.is_super_admin()
          or (
            r.municipality_id is not null
            and public.has_municipality_role(
              r.municipality_id,
              array['municipality_admin', 'municipality_operator']
            )
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Bildirim gönderme
-- ---------------------------------------------------------------------------

/** Bildirim gönderme ödülü. Tek yerde dursun diye sabit. */
create or replace function public.problem_report_reward()
returns table (xp integer, coin integer)
language sql
immutable
set search_path = ''
as $$ select 25, 10 $$;

create or replace function public.problem_resolved_reward()
returns table (xp integer, coin integer)
language sql
immutable
set search_path = ''
as $$ select 75, 40 $$;

/*
  Yeni bildirim açar.

  Belediye kullanıcının profil ilçesinden türetiliyor; eşleşen belediye yoksa
  null kalıyor ve rapor yalnızca süper adminin kuyruğunda görünüyor. Bildirimi
  reddetmek yerine kaydetmek tercih edildi: kullanıcının ilçesinde henüz
  belediye tanımlı olmaması onun sorunu değil.

  Ödül idempotent (problem_id + reason kısmi tekil indeksi).
*/
create or replace function public.report_problem(
  p_kind text,
  p_category_id integer,
  p_title text,
  p_description text,
  p_photo_path text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_address_text text default null
)
returns public.problem_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_municipality uuid;
  v_row public.problem_reports;
  v_xp integer;
  v_coin integer;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  if p_kind not in ('problem', 'oneri', 'proje') then
    raise exception 'Geçersiz bildirim türü.';
  end if;

  if p_title is null or length(trim(p_title)) < 5 then
    raise exception 'Başlık en az 5 karakter olmalı.';
  end if;

  if p_description is null or length(trim(p_description)) < 15 then
    raise exception 'Açıklama en az 15 karakter olmalı.';
  end if;

  if not exists (select 1 from public.problem_categories where id = p_category_id) then
    raise exception 'Kategori seçmelisin.';
  end if;

  if p_photo_path is not null and length(trim(p_photo_path)) > 0 then
    if not exists (
      select 1 from storage.objects
      where bucket_id = 'problem-photos'
        and name = p_photo_path
        and owner_id = v_uid::text
    ) then
      raise exception 'Fotoğraf bulunamadı. Lütfen tekrar yükle.';
    end if;
  end if;

  select m.id into v_municipality
  from public.profiles p
  join public.municipalities m
    on m.district_id = p.district_id
   and m.status = 'active'
  where p.id = v_uid
  limit 1;

  insert into public.problem_reports (
    user_id, municipality_id, category_id, kind, title, description,
    photo_path, lat, lng, address_text
  )
  values (
    v_uid, v_municipality, p_category_id, p_kind, trim(p_title), trim(p_description),
    nullif(trim(coalesce(p_photo_path, '')), ''), p_lat, p_lng,
    nullif(trim(coalesce(p_address_text, '')), '')
  )
  returning * into v_row;

  insert into public.problem_status_history (report_id, old_status, new_status, changed_by)
  values (v_row.id, null, 'new', v_uid);

  select r.xp, r.coin into v_xp, v_coin from public.problem_report_reward() r;

  insert into public.xp_transactions (user_id, amount, reason, problem_id)
  values (v_uid, v_xp, 'problem_report', v_row.id)
  on conflict do nothing;

  insert into public.coin_transactions (user_id, amount, reason, problem_id)
  values (v_uid, v_coin, 'problem_report', v_row.id)
  on conflict do nothing;

  -- Bildirim kullanıcının kendi işlemi; ayrıca haber vermeye gerek yok.
  perform public.check_and_award_badges(v_uid);

  return v_row;
end;
$$;

revoke all on function public.report_problem(text, integer, text, text, text, double precision, double precision, text) from public;
revoke all on function public.report_problem(text, integer, text, text, text, double precision, double precision, text) from anon;
grant execute on function public.report_problem(text, integer, text, text, text, double precision, double precision, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Durum değiştirme
-- ---------------------------------------------------------------------------

/*
  Raporun durumunu değiştirir ve geçmişe yazar.

  resolved'a ilk geçişte kullanıcıya bir kez ödül veriliyor. Kısmi tekil
  indeks sayesinde durum resolved'dan çıkıp geri dönse bile ödül tekrar
  yazılmıyor.
*/
create or replace function public.set_problem_status(
  p_report_id uuid,
  p_new_status text,
  p_note text default null
)
returns public.problem_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_report public.problem_reports;
  v_row public.problem_reports;
  v_xp integer;
  v_coin integer;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  if p_new_status not in ('new', 'reviewing', 'in_progress', 'resolved', 'rejected') then
    raise exception 'Geçersiz durum.';
  end if;

  select * into v_report from public.problem_reports where id = p_report_id;

  if v_report.id is null then
    raise exception 'Bildirim bulunamadı.';
  end if;

  if not (
    public.is_super_admin()
    or (
      v_report.municipality_id is not null
      and public.has_municipality_role(
        v_report.municipality_id,
        array['municipality_admin', 'municipality_operator']
      )
    )
  ) then
    raise exception 'Bu bildirimi yönetme yetkin yok.';
  end if;

  if v_report.status = p_new_status then
    return v_report;
  end if;

  update public.problem_reports
  set status = p_new_status,
      resolved_at = case when p_new_status = 'resolved' then now() else resolved_at end
  where id = p_report_id
  returning * into v_row;

  insert into public.problem_status_history (report_id, old_status, new_status, changed_by, note)
  values (p_report_id, v_report.status, p_new_status, v_uid, p_note);

  if p_new_status = 'resolved' then
    select r.xp, r.coin into v_xp, v_coin from public.problem_resolved_reward() r;

    insert into public.xp_transactions (user_id, amount, reason, problem_id)
    values (v_row.user_id, v_xp, 'problem_resolved', v_row.id)
    on conflict do nothing;

    insert into public.coin_transactions (user_id, amount, reason, problem_id)
    values (v_row.user_id, v_coin, 'problem_resolved', v_row.id)
    on conflict do nothing;

    perform public.check_and_award_badges(v_row.user_id);
  end if;

  perform public.notify(
    v_row.user_id,
    'problem_status',
    v_row.title || ' bildirimin güncellendi',
    case p_new_status
      when 'reviewing' then 'Bildirimin inceleniyor.'
      when 'in_progress' then 'Bildirimin için çalışma başladı.'
      when 'resolved' then 'Bildirimin çözüldü. Teşekkürler!'
      when 'rejected' then coalesce(p_note, 'Bildirimin kabul edilmedi.')
      else 'Bildiriminin durumu değişti.'
    end,
    v_row.id
  );

  return v_row;
end;
$$;

revoke all on function public.set_problem_status(uuid, text, text) from public;
revoke all on function public.set_problem_status(uuid, text, text) from anon;
grant execute on function public.set_problem_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.problem_categories enable row level security;
alter table public.problem_reports enable row level security;
alter table public.problem_status_history enable row level security;

create policy problem_categories_select_public on public.problem_categories
  for select to anon, authenticated using (true);
create policy problem_categories_write_super on public.problem_categories
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy problem_reports_select_own on public.problem_reports
  for select to authenticated using (user_id = (select auth.uid()));

create policy problem_reports_select_staff on public.problem_reports
  for select to authenticated using (
    municipality_id is not null
    and public.has_municipality_role(
      municipality_id,
      array['municipality_admin', 'municipality_operator']
    )
  );

create policy problem_reports_select_super on public.problem_reports
  for select to authenticated using (public.is_super_admin());

-- Yazma yalnızca report_problem / set_problem_status içinden.

create policy problem_status_history_select_own on public.problem_status_history
  for select to authenticated using (
    exists (
      select 1 from public.problem_reports r
      where r.id = problem_status_history.report_id
        and r.user_id = (select auth.uid())
    )
  );

create policy problem_status_history_select_staff on public.problem_status_history
  for select to authenticated using (
    exists (
      select 1 from public.problem_reports r
      where r.id = problem_status_history.report_id
        and (
          public.is_super_admin()
          or (
            r.municipality_id is not null
            and public.has_municipality_role(
              r.municipality_id,
              array['municipality_admin', 'municipality_operator']
            )
          )
        )
    )
  );

revoke all on public.problem_categories from anon, authenticated;
grant select on public.problem_categories to anon, authenticated;
grant insert, update, delete on public.problem_categories to authenticated;

revoke all on public.problem_reports from anon, authenticated;
grant select on public.problem_reports to authenticated;

revoke all on public.problem_status_history from anon, authenticated;
grant select on public.problem_status_history to authenticated;
