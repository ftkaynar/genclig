-- Takımlar ve takım görevleri.

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  -- Kod telefonda okunup elle giriliyor; karışan karakterler alfabede yok.
  invite_code text not null unique,
  captain_id uuid not null references auth.users (id) on delete cascade,
  max_members integer not null default 5 check (max_members between 2 and 10),
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('captain', 'member')),
  joined_at timestamptz not null default now(),

  primary key (team_id, user_id),
  -- Kullanıcı tek takımda: iki takımda birden olmak takım görevi sayımını
  -- hangi takıma yazacağını belirsiz bırakırdı.
  constraint team_members_single_team unique (user_id)
);

create index team_members_user_idx on public.team_members (user_id);

-- ---------------------------------------------------------------------------
-- Görevlere takım alanları
-- ---------------------------------------------------------------------------

alter table public.tasks
  add column if not exists scope text not null default 'individual'
    check (scope in ('individual', 'team')),
  add column if not exists min_team_size integer
    check (min_team_size is null or min_team_size between 2 and 10),
  add column if not exists team_bonus_xp integer not null default 0
    check (team_bonus_xp >= 0),
  add column if not exists team_bonus_coin integer not null default 0
    check (team_bonus_coin >= 0);

-- Takım bonusu işlem tablolarında ayrı bir sebep.
alter table public.xp_transactions drop constraint xp_transactions_reason_check;
alter table public.xp_transactions add constraint xp_transactions_reason_check
  check (reason in (
    'task', 'badge', 'adjustment', 'problem_report', 'problem_resolved',
    'team_bonus'
  ));

alter table public.coin_transactions drop constraint coin_transactions_reason_check;
alter table public.coin_transactions add constraint coin_transactions_reason_check
  check (reason in (
    'task', 'badge', 'reward_spend', 'adjustment', 'problem_report',
    'problem_resolved', 'team_bonus'
  ));

-- Takım bonusu teslim başına tek sefer.
create unique index xp_transactions_team_bonus_unique
  on public.xp_transactions (submission_id)
  where reason = 'team_bonus' and submission_id is not null;

create unique index coin_transactions_team_bonus_unique
  on public.coin_transactions (submission_id)
  where reason = 'team_bonus' and submission_id is not null;

-- ---------------------------------------------------------------------------
-- Takım kodu
-- ---------------------------------------------------------------------------

create or replace function public.generate_team_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i integer;
begin
  loop
    v_code := '';
    for v_i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
    end loop;

    exit when not exists (select 1 from public.teams where invite_code = v_code);
  end loop;

  return v_code;
end;
$$;

revoke all on function public.generate_team_code() from public;
revoke all on function public.generate_team_code() from anon;
revoke all on function public.generate_team_code() from authenticated;

-- ---------------------------------------------------------------------------
-- Takım yönetimi
-- ---------------------------------------------------------------------------

create or replace function public.create_team(p_name text, p_icon text default 'users')
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.teams;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  if exists (select 1 from public.team_members where user_id = v_uid) then
    raise exception 'Zaten bir takımdasın. Önce mevcut takımdan ayrıl.';
  end if;

  if p_name is null or length(trim(p_name)) < 3 then
    raise exception 'Takım adı en az 3 karakter olmalı.';
  end if;

  insert into public.teams (name, icon, invite_code, captain_id)
  values (trim(p_name), coalesce(nullif(trim(p_icon), ''), 'users'),
          public.generate_team_code(), v_uid)
  returning * into v_row;

  insert into public.team_members (team_id, user_id, role)
  values (v_row.id, v_uid, 'captain');

  return v_row;
end;
$$;

revoke all on function public.create_team(text, text) from public;
revoke all on function public.create_team(text, text) from anon;
grant execute on function public.create_team(text, text) to authenticated;

create or replace function public.join_team(p_code text)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team public.teams;
  v_count integer;
  v_me text;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  if exists (select 1 from public.team_members where user_id = v_uid) then
    raise exception 'Zaten bir takımdasın.';
  end if;

  select * into v_team from public.teams where invite_code = upper(trim(p_code));

  if v_team.id is null then
    raise exception 'Bu koda ait takım bulunamadı.';
  end if;

  select count(*) into v_count from public.team_members where team_id = v_team.id;

  if v_count >= v_team.max_members then
    raise exception 'Takım dolu.';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (v_team.id, v_uid, 'member');

  select username into v_me from public.profiles where id = v_uid;

  perform public.notify(
    v_team.captain_id,
    'team_invite',
    coalesce(v_me, 'Bir kullanıcı') || ' takımına katıldı',
    v_team.name || ' takımının yeni üyesi var.',
    v_team.id
  );

  return v_team;
end;
$$;

revoke all on function public.join_team(text) from public;
revoke all on function public.join_team(text) from anon;
grant execute on function public.join_team(text) to authenticated;

/*
  Takımdan ayrılma.

  Kaptan ayrılırken başka üye varsa kaptanlığı devretmesi isteniyor: takımı
  kaptansız bırakmak, kimsenin üye çıkaramadığı ve kod paylaşamadığı bir
  takım demekti. Tek kişiyse takım tamamen siliniyor.
*/
create or replace function public.leave_team()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_member public.team_members;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  select * into v_member from public.team_members where user_id = v_uid;

  if v_member.team_id is null then
    raise exception 'Bir takımda değilsin.';
  end if;

  select count(*) into v_count
  from public.team_members where team_id = v_member.team_id;

  if v_member.role = 'captain' and v_count > 1 then
    raise exception 'Önce kaptanlığı bir üyeye devretmelisin.';
  end if;

  delete from public.team_members where user_id = v_uid;

  if v_count = 1 then
    delete from public.teams where id = v_member.team_id;
  end if;
end;
$$;

revoke all on function public.leave_team() from public;
revoke all on function public.leave_team() from anon;
grant execute on function public.leave_team() to authenticated;

create or replace function public.kick_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team uuid;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  select team_id into v_team
  from public.team_members
  where user_id = v_uid and role = 'captain';

  if v_team is null then
    raise exception 'Bu işlem için takım kaptanı olmalısın.';
  end if;

  if p_user = v_uid then
    raise exception 'Kendini çıkaramazsın; takımdan ayrılmayı kullan.';
  end if;

  delete from public.team_members
  where team_id = v_team and user_id = p_user;
end;
$$;

revoke all on function public.kick_member(uuid) from public;
revoke all on function public.kick_member(uuid) from anon;
grant execute on function public.kick_member(uuid) to authenticated;

create or replace function public.transfer_captain(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team uuid;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  select team_id into v_team
  from public.team_members
  where user_id = v_uid and role = 'captain';

  if v_team is null then
    raise exception 'Bu işlem için takım kaptanı olmalısın.';
  end if;

  if not exists (
    select 1 from public.team_members
    where team_id = v_team and user_id = p_user
  ) then
    raise exception 'Bu kullanıcı takımında değil.';
  end if;

  update public.team_members set role = 'member'
  where team_id = v_team and user_id = v_uid;

  update public.team_members set role = 'captain'
  where team_id = v_team and user_id = p_user;

  update public.teams set captain_id = p_user where id = v_team;
end;
$$;

revoke all on function public.transfer_captain(uuid) from public;
revoke all on function public.transfer_captain(uuid) from anon;
grant execute on function public.transfer_captain(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Takım okuma
-- ---------------------------------------------------------------------------

create or replace function public.my_team()
returns table (
  team_id uuid,
  name text,
  icon text,
  invite_code text,
  captain_id uuid,
  max_members integer,
  member_count integer,
  my_role text
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
    t.id, t.name, t.icon, t.invite_code, t.captain_id, t.max_members,
    (select count(*)::integer from public.team_members m where m.team_id = t.id),
    tm.role
  from public.team_members tm
  join public.teams t on t.id = tm.team_id
  where tm.user_id = v_uid;
end;
$$;

revoke all on function public.my_team() from public;
revoke all on function public.my_team() from anon;
grant execute on function public.my_team() to authenticated;

create or replace function public.my_team_members()
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  role text,
  level integer,
  weekly_xp integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team uuid;
  v_since timestamptz;
begin
  if v_uid is null then
    return;
  end if;

  select team_id into v_team from public.team_members where user_id = v_uid;
  if v_team is null then
    return;
  end if;

  v_since := public.period_start('week');

  return query
  select
    p.id,
    p.username::text,
    p.avatar_url,
    m.role,
    (select l.level from public.level_from_xp(
      coalesce((select sum(x.amount)::integer from public.xp_transactions x where x.user_id = p.id), 0)
    ) l),
    coalesce(
      (select sum(x.amount)::integer from public.xp_transactions x
        where x.user_id = p.id and x.created_at >= v_since),
      0
    )
  from public.team_members m
  join public.profiles p on p.id = m.user_id
  where m.team_id = v_team
  order by m.role desc, p.username;
end;
$$;

revoke all on function public.my_team_members() from public;
revoke all on function public.my_team_members() from anon;
grant execute on function public.my_team_members() to authenticated;

/** Takım sıralaması: üyelerin dönem XP toplamı. */
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
  if p_period not in ('week', 'month', 'all') then
    raise exception 'Geçersiz dönem.';
  end if;

  v_since := public.period_start(p_period);

  return query
  with totals as (
    select
      t.id,
      t.name,
      t.icon,
      (select count(*)::integer from public.team_members m where m.team_id = t.id) as members,
      coalesce((
        select sum(x.amount)::integer
        from public.team_members m
        join public.xp_transactions x on x.user_id = m.user_id
        where m.team_id = t.id and x.created_at >= v_since
      ), 0) as xp
    from public.teams t
  )
  select
    row_number() over (order by totals.xp desc, totals.name asc)::integer,
    totals.id,
    totals.name,
    totals.icon,
    totals.members,
    totals.xp
  from totals
  where totals.xp > 0
  order by totals.xp desc, totals.name asc
  limit 50;
end;
$$;

revoke all on function public.leaderboard_teams(text) from public;
revoke all on function public.leaderboard_teams(text) from anon;
grant execute on function public.leaderboard_teams(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Takım bonusu ödül akışına bağlanıyor
-- ---------------------------------------------------------------------------

/*
  Ödül yazımı.

  Takım görevlerinde: aynı takımdan aynı dönemde onaylanmış üye sayısı
  min_team_size eşiğini geçtiği anda, o eşiği sağlayan TÜM üyelere bonus
  yazılıyor. Eşiği aşan üye tek başına bonus almıyor — görev takımca
  tamamlanmış sayılıyor.

  Bonus her üyenin kendi submission_id'siyle yazıldığı için kısmi tekil indeks
  ikinci kez yazılmasını engelliyor; eşik sonradan bir üye daha tamamladığında
  yeniden çalışsa bile önceki üyelere tekrar bonus düşmüyor.
*/
create or replace function public.award_task_points(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.task_submissions;
  v_task public.tasks;
  v_team uuid;
  v_done integer;
  v_member record;
begin
  select * into v_submission
  from public.task_submissions
  where id = p_submission_id;

  if v_submission.id is null or v_submission.status <> 'approved' then
    return;
  end if;

  select * into v_task from public.tasks where id = v_submission.task_id;

  if v_task.id is null then
    return;
  end if;

  if v_task.xp > 0 then
    insert into public.xp_transactions (user_id, amount, reason, submission_id)
    values (v_submission.user_id, v_task.xp, 'task', v_submission.id)
    on conflict do nothing;
  end if;

  if v_task.coin > 0 then
    insert into public.coin_transactions (user_id, amount, reason, submission_id)
    values (v_submission.user_id, v_task.coin, 'task', v_submission.id)
    on conflict do nothing;
  end if;

  -- Takım bonusu.
  if v_task.scope = 'team'
     and (v_task.team_bonus_xp > 0 or v_task.team_bonus_coin > 0) then

    select team_id into v_team
    from public.team_members where user_id = v_submission.user_id;

    if v_team is not null then
      select count(*) into v_done
      from public.task_submissions s
      join public.team_members m on m.user_id = s.user_id
      where s.task_id = v_task.id
        and s.period_key = v_submission.period_key
        and s.status = 'approved'
        and m.team_id = v_team;

      if v_done >= coalesce(v_task.min_team_size, 2) then
        for v_member in
          select s.id as submission_id, s.user_id
          from public.task_submissions s
          join public.team_members m on m.user_id = s.user_id
          where s.task_id = v_task.id
            and s.period_key = v_submission.period_key
            and s.status = 'approved'
            and m.team_id = v_team
        loop
          if v_task.team_bonus_xp > 0 then
            insert into public.xp_transactions (user_id, amount, reason, submission_id)
            values (v_member.user_id, v_task.team_bonus_xp, 'team_bonus', v_member.submission_id)
            on conflict do nothing;
          end if;

          if v_task.team_bonus_coin > 0 then
            insert into public.coin_transactions (user_id, amount, reason, submission_id)
            values (v_member.user_id, v_task.team_bonus_coin, 'team_bonus', v_member.submission_id)
            on conflict do nothing;
          end if;

          perform public.notify(
            v_member.user_id,
            'system',
            'Takım bonusu kazandın',
            v_task.title || ' görevini takımca tamamladınız: +'
              || v_task.team_bonus_xp || ' XP • +' || v_task.team_bonus_coin || ' Coin',
            v_task.id
          );
        end loop;
      end if;
    end if;
  end if;

  perform public.check_and_award_badges(v_submission.user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_task: takımsız kullanıcı takım görevine giremez
-- ---------------------------------------------------------------------------

create or replace function public.submit_task(
  p_task_id uuid,
  p_lat double precision default null,
  p_lng double precision default null,
  p_photo_path text default null
)
returns public.task_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_task public.tasks;
  v_period text;
  v_distance double precision;
  v_status text;
  v_reviewed_at timestamptz;
  v_row public.task_submissions;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  select * into v_task from public.tasks where id = p_task_id;

  if v_task.id is null then
    raise exception 'Görev bulunamadı.';
  end if;

  if v_task.status <> 'active' then
    raise exception 'Görev aktif değil.';
  end if;

  if v_task.starts_at is not null and v_task.starts_at > now() then
    raise exception 'Görev henüz başlamadı.';
  end if;

  if v_task.ends_at is not null and v_task.ends_at < now() then
    raise exception 'Görevin süresi dolmuş.';
  end if;

  -- Takım görevi kontrolü, diğer doğrulamalardan önce: kullanıcı fotoğraf
  -- çekip konum verdikten sonra "takımın yok" demek boşa emek olurdu.
  if v_task.scope = 'team'
     and not exists (select 1 from public.team_members where user_id = v_uid) then
    raise exception 'Bu görev takım görevi — önce bir takıma katıl.';
  end if;

  v_period := public.task_period_key(v_task.type, now());

  if exists (
    select 1
    from public.task_submissions
    where task_id = p_task_id
      and user_id = v_uid
      and period_key = v_period
      and status in ('pending', 'approved')
  ) then
    raise exception 'Bu görevi zaten gönderdin.';
  end if;

  if v_task.capacity is not null
     and public.task_participant_count(p_task_id) >= v_task.capacity then
    raise exception 'Bu görevin kontenjanı doldu.';
  end if;

  if v_task.verification in ('gps', 'photo_gps') then
    if p_lat is null or p_lng is null then
      raise exception 'Konum bilgisi alınamadı.';
    end if;

    if v_task.lat is null or v_task.lng is null then
      raise exception 'Görevin hedef konumu tanımlı değil.';
    end if;

    v_distance := 6371000 * 2 * asin(sqrt(
      power(sin(radians(p_lat - v_task.lat) / 2), 2)
      + cos(radians(v_task.lat)) * cos(radians(p_lat))
        * power(sin(radians(p_lng - v_task.lng) / 2), 2)
    ));

    if v_distance > coalesce(v_task.radius_m, 0) then
      raise exception 'Hedefe ~% m uzaktasın.', round(v_distance)::text;
    end if;
  end if;

  if v_task.verification in ('photo', 'photo_gps') then
    if p_photo_path is null or length(trim(p_photo_path)) = 0 then
      raise exception 'Fotoğraf yüklenmedi.';
    end if;

    if not exists (
      select 1
      from storage.objects
      where bucket_id = 'task-proofs'
        and name = p_photo_path
        and owner_id = v_uid::text
    ) then
      raise exception 'Fotoğraf bulunamadı. Lütfen tekrar yükle.';
    end if;
  end if;

  if v_task.verification = 'gps' then
    v_status := 'approved';
    v_reviewed_at := now();
  else
    v_status := 'pending';
    v_reviewed_at := null;
  end if;

  insert into public.task_submissions (
    task_id, user_id, status, photo_path,
    submitted_lat, submitted_lng, distance_m, reviewed_at
  )
  values (
    p_task_id, v_uid, v_status, p_photo_path,
    p_lat, p_lng, v_distance, v_reviewed_at
  )
  returning * into v_row;

  if v_row.status = 'approved' then
    perform public.award_task_points(v_row.id);
  end if;

  return v_row;
end;
$$;

revoke all on function public.submit_task(uuid, double precision, double precision, text) from public;
revoke all on function public.submit_task(uuid, double precision, double precision, text) from anon;
grant execute on function public.submit_task(uuid, double precision, double precision, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: iki takım görevi
-- ---------------------------------------------------------------------------

insert into public.tasks (
  id, municipality_id, category_id, type, title, description, instructions,
  xp, coin, verification, icon, difficulty, lat, lng, radius_m,
  starts_at, ends_at, capacity, status, scope, min_team_size,
  team_bonus_xp, team_bonus_coin
)
values
  (
    '0000f1a5-0000-4000-8000-0000000000e1',
    null,
    (select id from public.task_categories where slug = 'environment'),
    'instant',
    'Takımınla sahil temizliğine katılın',
    'Takımından en az 2 kişi sahil temizliğine katılsın ve fotoğraflasın.',
    'Her üye kendi fotoğrafını gönderir. Eşik sağlandığında bonus herkese yazılır.',
    120, 60, 'photo_gps', 'waves', 'medium',
    40.986500, 29.025400, 300,
    now(), now() + interval '14 days', null, 'active', 'team', 2,
    100, 50
  )
on conflict do nothing;

insert into public.tasks (
  id, municipality_id, category_id, type, title, description, instructions,
  xp, coin, verification, icon, difficulty, lat, lng, radius_m,
  status, scope, min_team_size, team_bonus_xp, team_bonus_coin
)
values
  (
    '0000f1a5-0000-4000-8000-0000000000e2',
    null,
    (select id from public.task_categories where slug = 'culture'),
    'continuous',
    'Takımca kültür noktası keşfedin',
    'Takımından en az 2 kişi aynı kültür noktasını ziyaret edip konumunu doğrulasın.',
    'Konum doğrulaması yeterli; fotoğraf gerekmiyor.',
    90, 45, 'gps', 'landmark', 'easy',
    41.013400, 28.981200, 200,
    'active', 'team', 2, 80, 40
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

/*
  Kullanıcı yalnızca kendi takımını görüyor; başka takımların satırları
  kapalı. Sıralama ve bonus hesabı definer fonksiyonlardan geçiyor.

  Denenen ve elenen alternatif: politikayı doğrudan team_members üzerinde
  "exists (select 1 from team_members ...)" ile yazmak. Elendi, çünkü
  politikanın kendi tablosunu okuması çalışma anında
  "infinite recursion detected in policy" hatası verdi (ölçüldü).
  security definer yardımcı RLS'i atlayarak döngüyü kırıyor ve dışarıya
  yalnızca çağıranın kendi takım kimliğini veriyor.
*/
create or replace function public.my_team_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select team_id from public.team_members where user_id = (select auth.uid());
$$;

revoke all on function public.my_team_id() from public;
revoke all on function public.my_team_id() from anon;
grant execute on function public.my_team_id() to authenticated;

create policy teams_select_own on public.teams
  for select to authenticated using (id = public.my_team_id());

create policy team_members_select_own on public.team_members
  for select to authenticated using (team_id = public.my_team_id());

revoke all on public.teams from anon, authenticated;
grant select on public.teams to authenticated;

revoke all on public.team_members from anon, authenticated;
grant select on public.team_members to authenticated;
