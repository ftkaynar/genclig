-- M30: 'year' dönemi, il kanal gezgini, görev görselleri.

-- ===========================================================================
-- 1. Sıralama dönemi: 'all' yerine 'year'
-- ===========================================================================

/*
  'Tümü' arayüzden kalkıyor, yerine 'Bu Yıl' geliyor.

  Neden: tüm zamanların sıralaması ilk kullanıcıları kalıcı olarak öne
  koyuyor ve sonradan katılanın yakalaması imkânsız — liste donuyor. Yıl
  penceresi her ocakta sıfırlanıyor, yarış canlı kalıyor.

  'all' DB'de KALIYOR: leaderboard_top/teams hâlâ kabul ediyor ve
  yönetim tarafında toplam bakmak gerekebilir. Yalnız arayüzden kalktı.

  Yıl sınırı Europe/Istanbul: sunucu UTC ve 1 Ocak'ta üç saat boyunca
  önceki yılın sıralaması görünürdü (aynı sınıf hata D09, D25, D29 ve
  D30'da ölçülmüştü).
*/
create or replace function public.period_start(p_period text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case p_period
    when 'week' then
      date_trunc('week', now() at time zone 'Europe/Istanbul')
        at time zone 'Europe/Istanbul'
    when 'month' then
      date_trunc('month', now() at time zone 'Europe/Istanbul')
        at time zone 'Europe/Istanbul'
    when 'year' then
      date_trunc('year', now() at time zone 'Europe/Istanbul')
        at time zone 'Europe/Istanbul'
    else '-infinity'::timestamptz
  end;
$$;

-- Dönem doğrulamalarına 'year' ekleniyor.
create or replace function public.leaderboard_teams(p_period text default 'week')
returns table (
  rank integer,
  team_id uuid,
  team_name text,
  icon text,
  member_count integer,
  total_xp integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_since timestamptz;
begin
  if p_period not in ('week', 'month', 'year', 'all') then
    raise exception 'Geçersiz dönem.';
  end if;

  v_since := public.period_start(p_period);

  return query
  with totals as (
    select
      t.id,
      t.name,
      t.icon,
      (select count(*)::integer from public.team_members m where m.team_id = t.id)
        as members,
      coalesce(sum(x.amount), 0)::integer as xp
    from public.teams t
    left join public.team_members tm on tm.team_id = t.id
    left join public.xp_transactions x
      on x.user_id = tm.user_id and x.created_at >= v_since
    group by t.id, t.name, t.icon
  )
  select
    row_number() over (order by q.xp desc, q.name asc)::integer,
    q.id,
    q.name::text,
    q.icon,
    q.members,
    q.xp
  from totals q
  where q.xp > 0
  order by q.xp desc, q.name asc
  limit 50;
end;
$$;

revoke all on function public.leaderboard_teams(text) from public, anon;
grant execute on function public.leaderboard_teams(text) to authenticated;

/*
  leaderboard_top'un dönem kontrolüne de 'year' ekleniyor. Gövde
  değişmiyor — yalnız izin verilen değerler listesi.
*/
create or replace function public.leaderboard_top(
  p_scope text default 'turkiye',
  p_period text default 'all',
  p_limit integer default 50
)
returns table (
  rank integer,
  user_id uuid,
  username text,
  level integer,
  total_xp integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_since timestamptz;
  v_province smallint;
  v_district bigint;
  v_neighborhood bigint;
begin
  if p_scope not in ('turkiye', 'il', 'ilce', 'mahalle', 'arkadaslar') then
    raise exception 'Geçersiz kapsam.';
  end if;
  if p_period not in ('week', 'month', 'year', 'all') then
    raise exception 'Geçersiz dönem.';
  end if;

  v_since := public.period_start(p_period);

  select p.province_id, p.district_id, p.neighborhood_id
  into v_province, v_district, v_neighborhood
  from public.profiles p where p.id = v_uid;

  return query
  with scoped as (
    select p.id, p.username
    from public.profiles p
    where p.username is not null
      and (
        p_scope = 'turkiye'
        or (p_scope = 'il' and v_province is not null and p.province_id = v_province)
        or (p_scope = 'ilce' and v_district is not null and p.district_id = v_district)
        or (p_scope = 'mahalle' and v_neighborhood is not null
            and p.neighborhood_id = v_neighborhood)
        or (p_scope = 'arkadaslar'
            and (p.id = v_uid or p.id in (select public.my_friend_ids())))
      )
  ),
  totals as (
    select s.id, s.username, coalesce(sum(x.amount), 0)::integer as xp
    from scoped s
    left join public.xp_transactions x
      on x.user_id = s.id and x.created_at >= v_since
    group by s.id, s.username
  )
  select
    row_number() over (order by t.xp desc, t.username asc)::integer,
    t.id,
    t.username::text,
    (select l.level from public.level_from_xp(t.xp) l),
    t.xp
  from totals t
  where t.xp > 0
  order by t.xp desc, t.username asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

revoke all on function public.leaderboard_top(text, text, integer) from public, anon;
grant execute on function public.leaderboard_top(text, text, integer) to authenticated;

-- my_rank da aynı dönemi kabul etmeli.
do $$
declare
  v_def text;
begin
  select pg_get_functiondef(oid) into v_def
  from pg_proc where proname = 'my_rank' limit 1;

  if v_def is not null and v_def like '%''week'', ''month'', ''all''%' then
    execute replace(v_def, '''week'', ''month'', ''all''',
                           '''week'', ''month'', ''year'', ''all''');
    raise notice 'my_rank donem listesine year eklendi';
  end if;
end;
$$;

-- ===========================================================================
-- 2. Topluluk: il kanal gezgini
-- ===========================================================================

/*
  Kullanıcı artık YALNIZ kendi ilinin kanalını değil, İSTEDİĞİ ilin
  kanalını okuyabiliyor ve oraya yazabiliyor.

  Neden: gençleri kendi illerine hapsetmek platformun amacına aykırı —
  "Türkiye'nin gençlik ligi" diyorsak İstanbul'daki bir kullanıcı
  Van'daki bir projeyi görebilmeli ve yazabilmeli.

  Güvenlik kuralları AYNEN duruyor ve her kanalda geçerli: oran sınırı,
  susturma, raporlama, 18-altı uyarısı. Değişen tek şey HANGİ kanala
  erişilebildiği.

  Erişim modeli: `channels_select_own` politikası "benim kanalım"dan
  "tüm il kanalları"na geçiyor. Mesaj okuma/yazma da aynı şekilde —
  ama YAZMA hâlâ post_message RPC'sinden geçiyor ve oradaki susturma ve
  oran sınırı kontrolleri değişmedi.
*/
drop policy if exists channels_select_own on public.channels;
create policy channels_select_all on public.channels
  for select to authenticated using (scope = 'province');

/*
  Mesaj okuma: artık herhangi bir il kanalı. Silinmiş mesajlar yine
  gizli; moderatör kendi politikasıyla (channel_messages_select_mod)
  silinmişleri de görüyor.
*/
drop policy if exists channel_messages_select_own on public.channel_messages;
create policy channel_messages_select_any on public.channel_messages
  for select to authenticated using (
    is_deleted = false
    and exists (
      select 1 from public.channels c
      where c.id = channel_id and c.scope = 'province'
    )
  );

/*
  post_message artık hedef kanalı parametre alıyor.

  Eski imza (parametresiz) KALDIRILMIYOR; arayüz güncellenene kadar
  çalışmaya devam etsin ve dağıtım sırası kırılmasın diye sarmalayıcı
  olarak duruyor.
*/
create or replace function public.post_message_to(
  p_channel uuid,
  p_body text
)
returns public.channel_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.channel_messages;
  v_recent integer;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'Mesaj boş olamaz.';
  end if;

  if length(trim(p_body)) > 500 then
    raise exception 'Mesaj en fazla 500 karakter olabilir.';
  end if;

  if not exists (
    select 1 from public.channels
    where id = p_channel and scope = 'province'
  ) then
    raise exception 'Kanal bulunamadı.';
  end if;

  if public.is_muted(p_channel) then
    raise exception 'Şu an mesaj gönderemezsin.';
  end if;

  /*
    Oran sınırı: 60 saniyede en fazla 5 mesaj. Kanal bazlı DEĞİL kullanıcı
    bazlı — il değiştirerek sınırı aşmak mümkün olmamalı.
  */
  select count(*) into v_recent
  from public.channel_messages
  where user_id = v_uid and created_at > now() - interval '60 seconds';

  if v_recent >= 5 then
    raise exception 'Çok hızlı yazıyorsun, biraz bekle.';
  end if;

  insert into public.channel_messages (channel_id, user_id, body)
  values (p_channel, v_uid, trim(p_body))
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.post_message_to(uuid, text) from public, anon;
grant execute on function public.post_message_to(uuid, text) to authenticated;

/*
  Seçilen kanalın başlığı ve susturma durumu.

  my_channel() (kendi ili) duruyor; bu yeni fonksiyon herhangi bir il
  kanalı için aynı bilgiyi veriyor.
*/
create or replace function public.channel_info(p_channel uuid)
returns table (
  channel_id uuid,
  name text,
  province_name text,
  muted_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return;
  end if;

  return query
  select
    c.id,
    c.name,
    pr.name,
    (select max(um.until) from public.user_mutes um
      where um.user_id = v_uid
        and um.until > now()
        and (um.channel_id is null or um.channel_id = c.id))
  from public.channels c
  join public.provinces pr on pr.id = c.province_id
  where c.id = p_channel and c.scope = 'province';
end;
$$;

revoke all on function public.channel_info(uuid) from public, anon;
grant execute on function public.channel_info(uuid) to authenticated;

/** Seçilen kanalın mesajları. */
create or replace function public.list_channel_messages_of(
  p_channel uuid,
  p_limit integer default 100
)
returns table (
  id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  body text,
  created_at timestamptz,
  is_mine boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return;
  end if;

  return query
  select
    m.id,
    m.user_id,
    p.username::text,
    p.avatar_url,
    m.body,
    m.created_at,
    m.user_id = v_uid
  from public.channel_messages m
  join public.profiles p on p.id = m.user_id
  where m.channel_id = p_channel and m.is_deleted = false
  order by m.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 200));
end;
$$;

revoke all on function public.list_channel_messages_of(uuid, integer)
  from public, anon;
grant execute on function public.list_channel_messages_of(uuid, integer)
  to authenticated;

-- ===========================================================================
-- 3. Görev görselleri
-- ===========================================================================

/*
  art_key: public/task-art/ altındaki görselin anahtarı (art-01..art-20).

  Yol DEĞİL anahtar saklanıyor: dosya düzeni değişirse (klasör adı,
  uzantı, boyut varyantları) tek yerden çözülüyor ve DB'deki yüzlerce
  satırı güncellemek gerekmiyor.

  null = görsel yok; kart mevcut kategori gradyanını kullanıyor.
*/
alter table public.tasks
  add column if not exists art_key text;

comment on column public.tasks.art_key is
  'public/task-art/ altındaki görsel anahtarı (art-01..art-20). Yol değil anahtar.';
