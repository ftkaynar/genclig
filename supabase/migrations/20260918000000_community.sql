-- Bölge topluluğu (M22): ilçe bazlı, salt metin, moderasyonlu sohbet.
--
-- Tasarım ilkesi çocuk güvenliği. Bu yüzden ilk sürümde bilerek YOK:
-- fotoğraf, bağlantı, özel mesaj. Yalnızca düz metin; moderasyon kuyruğu
-- ve susturma en baştan var, sonradan eklenen bir şey değil.

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  -- Şimdilik yalnızca ilçe kanalı var; sütun il/mahalle için yer tutuyor.
  scope text not null default 'district' check (scope in ('district')),
  district_id bigint not null references public.districts (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),

  unique (scope, district_id)
);

create table public.channel_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  /*
    Soft delete: mesaj silinince satır kalıyor.
    Neden: moderasyon kaydı olmadan "bu kullanıcı ne yazmıştı" sorusuna
    cevap veremezdik ve tekrarlayan ihlalleri göremezdik. Kullanıcı
    tarafında is_deleted = false filtresi var, personel silinmişleri de
    görüyor.
  */
  is_deleted boolean not null default false,
  deleted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index channel_messages_channel_idx
  on public.channel_messages (channel_id, created_at desc);
create index channel_messages_user_idx
  on public.channel_messages (user_id, created_at desc);

create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.channel_messages (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),

  -- Bir kişi bir mesajı bir kez raporlar; aksi halde tek kişi otomatik
  -- gizleme eşiğini tek başına doldurabilirdi.
  unique (message_id, reporter_id)
);

create index message_reports_status_idx on public.message_reports (status, created_at desc);

create table public.user_mutes (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- null = global susturma (tüm kanallar).
  channel_id uuid references public.channels (id) on delete cascade,
  muted_by uuid not null references auth.users (id) on delete cascade,
  until timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),

  -- nulls not distinct: global susturma da tekil olmalı, yoksa aynı
  -- kullanıcıya defalarca global susturma satırı eklenebilirdi.
  constraint user_mutes_unique unique nulls not distinct (user_id, channel_id)
);

create index user_mutes_user_idx on public.user_mutes (user_id, until desc);

-- Bildirim tipine 'community' ekleniyor.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'submission_approved', 'submission_rejected', 'badge_earned',
    'problem_status', 'reward_redeemed', 'system',
    'friend_request', 'friend_accepted', 'team_invite', 'support_reply',
    'announcement', 'community'
  ));

-- ---------------------------------------------------------------------------
-- Seed: İstanbul'un ilçeleri için birer kanal
-- ---------------------------------------------------------------------------

insert into public.channels (scope, district_id, name)
select 'district', d.id, d.name || ' Topluluğu'
from public.districts d
where d.province_id = 34
on conflict (scope, district_id) do nothing;

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------

/*
  Çağıranın kendi ilçe kanalı.

  security definer: kanal kimliğini bulmak için profiles okunuyor ve RLS
  altında kullanıcı kendi satırını görse de politikaların içinden
  çağrıldığında özyineleme riski var (D21'de team_members'ta ölçüldü).
  Fonksiyon dışarıya yalnızca çağıranın kendi kanal kimliğini veriyor.
*/
create or replace function public.my_channel_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select c.id
  from public.profiles p
  join public.channels c
    on c.scope = 'district' and c.district_id = p.district_id
  where p.id = (select auth.uid());
$$;

revoke all on function public.my_channel_id() from public;
revoke all on function public.my_channel_id() from anon;
grant execute on function public.my_channel_id() to authenticated;

/*
  Çağıran bu kanalın moderatörü mü?

  Moderatör = süper admin, ya da kanalın ilçesindeki bir belediyede
  yetkili personel. Belediye ilçeye province/district üzerinden değil,
  municipalities.district_id üzerinden bağlanıyor.
*/
create or replace function public.can_moderate_channel(p_channel uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.channels c
      join public.municipalities m on m.district_id = c.district_id
      where c.id = p_channel
        and public.has_municipality_role(
          m.id, array['municipality_admin', 'municipality_operator', 'moderator']
        )
    );
$$;

revoke all on function public.can_moderate_channel(uuid) from public;
revoke all on function public.can_moderate_channel(uuid) from anon;
grant execute on function public.can_moderate_channel(uuid) to authenticated;

/** Çağıran şu an susturulmuş mu (global ya da bu kanalda)? */
create or replace function public.is_muted(p_channel uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.user_mutes
    where user_id = (select auth.uid())
      and until > now()
      and (channel_id is null or channel_id = p_channel)
  );
$$;

revoke all on function public.is_muted(uuid) from public;
revoke all on function public.is_muted(uuid) from anon;
grant execute on function public.is_muted(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Yazma
-- ---------------------------------------------------------------------------

/*
  Mesaj gönderme.

  Hız sınırı iki katmanlı ve sunucuda:
  - son 10 saniyede bir mesaj varsa reddediliyor (arka arkaya spam),
  - son 1 dakikada 5 mesaj varsa reddediliyor (yavaş ama sürekli spam).
  İstemci tarafı sayaç yeterli olmazdı; istek doğrudan da atılabilir.
*/
create or replace function public.post_message(p_body text)
returns public.channel_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_channel uuid;
  v_row public.channel_messages;
  v_recent integer;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  v_channel := public.my_channel_id();

  if v_channel is null then
    raise exception 'Önce ilçeni ayarla.';
  end if;

  if p_body is null or char_length(trim(p_body)) = 0 then
    raise exception 'Mesaj boş olamaz.';
  end if;

  if char_length(trim(p_body)) > 500 then
    raise exception 'Mesaj en fazla 500 karakter olabilir.';
  end if;

  if public.is_muted(v_channel) then
    raise exception 'Bu kanalda geçici olarak yazamıyorsun.';
  end if;

  if exists (
    select 1 from public.channel_messages
    where user_id = v_uid and created_at > now() - interval '10 seconds'
  ) then
    raise exception 'Biraz yavaş, birkaç saniye bekle.';
  end if;

  select count(*) into v_recent
  from public.channel_messages
  where user_id = v_uid and created_at > now() - interval '1 minute';

  if v_recent >= 5 then
    raise exception 'Çok fazla mesaj gönderdin, bir dakika bekle.';
  end if;

  insert into public.channel_messages (channel_id, user_id, body)
  values (v_channel, v_uid, trim(p_body))
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.post_message(text) from public;
revoke all on function public.post_message(text) from anon;
grant execute on function public.post_message(text) to authenticated;

create or replace function public.delete_own_message(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  update public.channel_messages
  set is_deleted = true, deleted_by = v_uid
  where id = p_id and user_id = v_uid and is_deleted = false;

  if not found then
    raise exception 'Mesaj bulunamadı.';
  end if;
end;
$$;

revoke all on function public.delete_own_message(uuid) from public;
revoke all on function public.delete_own_message(uuid) from anon;
grant execute on function public.delete_own_message(uuid) to authenticated;

/*
  Mesaj raporlama.

  Üç farklı kişi aynı mesajı raporladığında mesaj otomatik gizleniyor.
  Neden otomatik: moderatör gece 3'te kuyruğa bakmıyor ve zararlı bir
  mesajın saatlerce görünür kalması, yanlışlıkla gizlenmiş bir mesajdan
  daha büyük zarar. Rapor kayıtları duruyor; moderatör kuyruktan mesajı
  geri açabilir (moderate_restore).

  Eşik 3: tek ya da iki kişi anlaşıp masum bir mesajı gizleyebilirdi;
  üç bağımsız rapor kasıtlı hedeflemeyi zorlaştırıyor.
*/
create or replace function public.report_message(p_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_msg public.channel_messages;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  select * into v_msg from public.channel_messages where id = p_id;

  if v_msg.id is null then
    raise exception 'Mesaj bulunamadı.';
  end if;

  if v_msg.user_id = v_uid then
    raise exception 'Kendi mesajını raporlayamazsın.';
  end if;

  -- Raporlayan, mesajın kanalına erişebilmeli; başka ilçenin mesajını
  -- raporlamak kanal izolasyonunu delmenin dolaylı yolu olurdu.
  if v_msg.channel_id <> public.my_channel_id()
     and not public.can_moderate_channel(v_msg.channel_id) then
    raise exception 'Bu mesajı raporlama yetkin yok.';
  end if;

  insert into public.message_reports (message_id, reporter_id, reason)
  values (p_id, v_uid, nullif(trim(p_reason), ''))
  on conflict (message_id, reporter_id) do nothing;

  select count(*) into v_count
  from public.message_reports where message_id = p_id;

  if v_count >= 3 and not v_msg.is_deleted then
    update public.channel_messages
    set is_deleted = true
    where id = p_id;
  end if;
end;
$$;

revoke all on function public.report_message(uuid, text) from public;
revoke all on function public.report_message(uuid, text) from anon;
grant execute on function public.report_message(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Moderasyon
-- ---------------------------------------------------------------------------

create or replace function public.moderate_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_channel uuid;
begin
  select channel_id into v_channel
  from public.channel_messages where id = p_id;

  if v_channel is null then
    raise exception 'Mesaj bulunamadı.';
  end if;

  if not public.can_moderate_channel(v_channel) then
    raise exception 'Bu kanalda moderasyon yetkin yok.';
  end if;

  update public.channel_messages
  set is_deleted = true, deleted_by = v_uid
  where id = p_id;

  update public.message_reports
  set status = 'resolved' where message_id = p_id;
end;
$$;

revoke all on function public.moderate_delete(uuid) from public;
revoke all on function public.moderate_delete(uuid) from anon;
grant execute on function public.moderate_delete(uuid) to authenticated;

/** Yanlışlıkla gizlenen mesajı geri açar ve raporları kapatır. */
create or replace function public.moderate_restore(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channel uuid;
begin
  select channel_id into v_channel
  from public.channel_messages where id = p_id;

  if v_channel is null then
    raise exception 'Mesaj bulunamadı.';
  end if;

  if not public.can_moderate_channel(v_channel) then
    raise exception 'Bu kanalda moderasyon yetkin yok.';
  end if;

  update public.channel_messages
  set is_deleted = false, deleted_by = null
  where id = p_id;

  update public.message_reports
  set status = 'resolved' where message_id = p_id;
end;
$$;

revoke all on function public.moderate_restore(uuid) from public;
revoke all on function public.moderate_restore(uuid) from anon;
grant execute on function public.moderate_restore(uuid) to authenticated;

create or replace function public.mute_user(
  p_user uuid,
  p_channel uuid default null,
  p_minutes integer default 60,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_target_channel uuid := p_channel;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  if p_minutes is null or p_minutes < 1 or p_minutes > 43200 then
    raise exception 'Susturma süresi 1 dakika ile 30 gün arasında olmalı.';
  end if;

  /*
    Global susturmayı yalnızca süper admin verebilir. Belediye personeli
    kendi kanalıyla sınırlı; aksi halde bir ilçenin moderatörü kullanıcıyı
    tüm ülkede susturabilirdi.
  */
  if v_target_channel is null then
    if not public.is_super_admin() then
      raise exception 'Global susturma yalnızca süper adminlere açıktır.';
    end if;
  elsif not public.can_moderate_channel(v_target_channel) then
    raise exception 'Bu kanalda moderasyon yetkin yok.';
  end if;

  if p_user = v_uid then
    raise exception 'Kendini susturamazsın.';
  end if;

  insert into public.user_mutes (user_id, channel_id, muted_by, until, reason)
  values (
    p_user, v_target_channel, v_uid,
    now() + make_interval(mins => p_minutes),
    nullif(trim(p_reason), '')
  )
  on conflict (user_id, channel_id) do update
    set until = excluded.until,
        muted_by = excluded.muted_by,
        reason = excluded.reason,
        created_at = now();

  perform public.notify(
    p_user,
    'community',
    'Toplulukta geçici olarak yazamıyorsun',
    coalesce(nullif(trim(p_reason), ''), 'Topluluk kurallarına aykırı paylaşım.'),
    v_target_channel
  );
end;
$$;

revoke all on function public.mute_user(uuid, uuid, integer, text) from public;
revoke all on function public.mute_user(uuid, uuid, integer, text) from anon;
grant execute on function public.mute_user(uuid, uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Okuma
-- ---------------------------------------------------------------------------

/*
  Kanal mesajları.

  security definer: mesajın yanında kullanıcı adı, avatar ve seviye
  gösteriliyor; üçü de profiles üzerinde ve RLS kullanıcıya yalnızca kendi
  satırını gösteriyor. Fonksiyon yalnızca çağıranın kendi kanalını
  (ya da moderatörse ilgili kanalı) veriyor.

  Sıra artan: sohbet düzeni, en yeni altta.
*/
create or replace function public.list_channel_messages(p_limit integer default 100)
returns table (
  id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  level integer,
  body text,
  is_deleted boolean,
  created_at timestamptz,
  is_mine boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_channel uuid;
begin
  if v_uid is null then
    return;
  end if;

  v_channel := public.my_channel_id();
  if v_channel is null then
    return;
  end if;

  return query
  select * from (
    select
      m.id,
      m.user_id,
      p.username::text,
      p.avatar_url,
      (select l.level from public.level_from_xp(
        coalesce((select sum(x.amount)::integer from public.xp_transactions x
                   where x.user_id = p.id), 0)
      ) l),
      m.body,
      m.is_deleted,
      m.created_at,
      m.user_id = v_uid
    from public.channel_messages m
    join public.profiles p on p.id = m.user_id
    where m.channel_id = v_channel
      and m.is_deleted = false
    order by m.created_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 200))
  ) recent
  order by recent.created_at asc;
end;
$$;

revoke all on function public.list_channel_messages(integer) from public;
revoke all on function public.list_channel_messages(integer) from anon;
grant execute on function public.list_channel_messages(integer) to authenticated;

/** Çağıranın kanal başlığı ve susturma durumu. */
create or replace function public.my_channel()
returns table (
  channel_id uuid,
  name text,
  district_name text,
  muted_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_channel uuid;
begin
  if v_uid is null then
    return;
  end if;

  v_channel := public.my_channel_id();
  if v_channel is null then
    return;
  end if;

  return query
  select
    c.id,
    c.name,
    d.name,
    (select max(um.until) from public.user_mutes um
      where um.user_id = v_uid
        and um.until > now()
        and (um.channel_id is null or um.channel_id = c.id))
  from public.channels c
  join public.districts d on d.id = c.district_id
  where c.id = v_channel;
end;
$$;

revoke all on function public.my_channel() from public;
revoke all on function public.my_channel() from anon;
grant execute on function public.my_channel() to authenticated;

/*
  Moderasyon kuyruğu: açık raporu olan mesajlar.

  Süper admin hepsini, personel yalnızca kendi ilçesinin kanalını görüyor.
  Mesaj gizlenmiş olsa da kuyrukta kalıyor — moderatörün kararı (silme ya
  da geri açma) gerekiyor.
*/
create or replace function public.list_moderation_queue()
returns table (
  message_id uuid,
  channel_id uuid,
  channel_name text,
  author_id uuid,
  author_username text,
  body text,
  is_deleted boolean,
  report_count integer,
  reasons text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return;
  end if;

  return query
  select
    m.id,
    c.id,
    c.name,
    m.user_id,
    p.username::text,
    m.body,
    m.is_deleted,
    count(r.id)::integer,
    string_agg(distinct r.reason, ' · '),
    min(r.created_at)
  from public.message_reports r
  join public.channel_messages m on m.id = r.message_id
  join public.channels c on c.id = m.channel_id
  join public.profiles p on p.id = m.user_id
  where r.status = 'open'
    and public.can_moderate_channel(m.channel_id)
  group by m.id, c.id, c.name, m.user_id, p.username, m.body, m.is_deleted
  order by count(r.id) desc, min(r.created_at) asc
  limit 200;
end;
$$;

revoke all on function public.list_moderation_queue() from public;
revoke all on function public.list_moderation_queue() from anon;
grant execute on function public.list_moderation_queue() to authenticated;

create or replace function public.resolve_report(p_message uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channel uuid;
begin
  select channel_id into v_channel
  from public.channel_messages where id = p_message;

  if v_channel is null then
    raise exception 'Mesaj bulunamadı.';
  end if;

  if not public.can_moderate_channel(v_channel) then
    raise exception 'Bu kanalda moderasyon yetkin yok.';
  end if;

  update public.message_reports
  set status = 'resolved' where message_id = p_message;
end;
$$;

revoke all on function public.resolve_report(uuid) from public;
revoke all on function public.resolve_report(uuid) from anon;
grant execute on function public.resolve_report(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.channels enable row level security;
alter table public.channel_messages enable row level security;
alter table public.message_reports enable row level security;
alter table public.user_mutes enable row level security;

-- Kullanıcı yalnızca kendi ilçe kanalını görüyor; moderatör ilgili kanalı.
create policy channels_select_own on public.channels
  for select to authenticated using (
    id = public.my_channel_id() or public.can_moderate_channel(id)
  );

create policy channels_write_super on public.channels
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy channel_messages_select_own on public.channel_messages
  for select to authenticated using (
    channel_id = public.my_channel_id() and is_deleted = false
  );

-- Moderatör silinmişleri de görüyor: karar vermek için içeriği okumalı.
create policy channel_messages_select_mod on public.channel_messages
  for select to authenticated using (
    public.can_moderate_channel(channel_id)
  );

create policy message_reports_select_mod on public.message_reports
  for select to authenticated using (
    exists (
      select 1 from public.channel_messages m
      where m.id = message_reports.message_id
        and public.can_moderate_channel(m.channel_id)
    )
  );

create policy user_mutes_select_own on public.user_mutes
  for select to authenticated using (user_id = (select auth.uid()));

create policy user_mutes_select_mod on public.user_mutes
  for select to authenticated using (
    channel_id is not null and public.can_moderate_channel(channel_id)
  );

/*
  INSERT/UPDATE/DELETE politikası bilerek yok ve yazma GRANT'i de
  verilmiyor. Mesaj yazmanın tek yolu post_message: hız sınırı, susturma
  kontrolü ve kanal çözümü orada. Client doğrudan insert edebilseydi
  hepsini atlardı.
*/
revoke all on public.channels from anon, authenticated;
grant select on public.channels to authenticated;
grant insert, update, delete on public.channels to authenticated;

revoke all on public.channel_messages from anon, authenticated;
grant select on public.channel_messages to authenticated;

revoke all on public.message_reports from anon, authenticated;
grant select on public.message_reports to authenticated;

revoke all on public.user_mutes from anon, authenticated;
grant select on public.user_mutes to authenticated;
