-- Arkadaşlık.
--
-- İlişki tek satırda tutuluyor ve iki yönlü: A→B ile B→A aynı ilişki.
-- Çift kayıt (her iki yön için ayrı satır) denendi ve elendi; iki satırı
-- senkron tutmak, kabul/ret akışında tutarsızlık riski demekti.

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'blocked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,

  constraint friendships_not_self check (requester_id <> addressee_id)
);

/*
  Yön bağımsız teklik: (A,B) ile (B,A) aynı çifti gösteriyor. least/greatest
  ile sıralanmış bir indeks, kimin istek attığından bağımsız olarak tek satır
  bırakıyor.
*/
create unique index friendships_pair_unique
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

create index friendships_addressee_idx
  on public.friendships (addressee_id, status);
create index friendships_requester_idx
  on public.friendships (requester_id, status);

-- ---------------------------------------------------------------------------
-- Bildirim türleri genişliyor
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'submission_approved', 'submission_rejected', 'badge_earned',
    'problem_status', 'reward_redeemed', 'system',
    'friend_request', 'friend_accepted', 'team_invite', 'support_reply'
  ));

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------

/** İki kullanıcı arkadaş mı? Profil kartı ve sıralama kapsamı kullanıyor. */
create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and (
        (requester_id = p_a and addressee_id = p_b)
        or (requester_id = p_b and addressee_id = p_a)
      )
  );
$$;

grant execute on function public.are_friends(uuid, uuid) to authenticated;

/** Çağıranın kabul edilmiş arkadaşlarının kimlikleri. */
create or replace function public.my_friend_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when f.requester_id = (select auth.uid()) then f.addressee_id
    else f.requester_id
  end
  from public.friendships f
  where f.status = 'accepted'
    and (select auth.uid()) in (f.requester_id, f.addressee_id);
$$;

grant execute on function public.my_friend_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- Kullanıcı arama
-- ---------------------------------------------------------------------------

/*
  Kullanıcı arama.

  Yalnızca kullanıcı adı, avatar ve seviye dönüyor — arama sonucu bir profil
  dökümü değil, "doğru kişiyi buldum mu" sorusuna cevap. En az üç karakter
  isteniyor: iki harflik sorgu neredeyse tüm kullanıcıları döndürüp listeyi
  tarama aracına çevirirdi.
*/
create or replace function public.search_users(p_q text)
returns table (username text, avatar_url text, level integer, user_id uuid)
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

  if p_q is null or length(trim(p_q)) < 3 then
    return;
  end if;

  return query
  select
    p.username::text,
    p.avatar_url,
    (select l.level from public.level_from_xp(
      coalesce((select sum(x.amount)::integer from public.xp_transactions x where x.user_id = p.id), 0)
    ) l),
    p.id
  from public.profiles p
  where p.username is not null
    and p.id <> v_uid
    and p.username ilike '%' || trim(p_q) || '%'
  order by p.username
  limit 10;
end;
$$;

revoke all on function public.search_users(text) from public;
revoke all on function public.search_users(text) from anon;
grant execute on function public.search_users(text) to authenticated;

-- ---------------------------------------------------------------------------
-- İstek gönderme ve yanıtlama
-- ---------------------------------------------------------------------------

create or replace function public.send_friend_request(p_username text)
returns public.friendships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_target uuid;
  v_me text;
  v_existing public.friendships;
  v_row public.friendships;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  select id into v_target
  from public.profiles
  where username = trim(p_username);

  if v_target is null then
    raise exception 'Bu kullanıcı adı bulunamadı.';
  end if;

  if v_target = v_uid then
    raise exception 'Kendine arkadaşlık isteği gönderemezsin.';
  end if;

  select * into v_existing
  from public.friendships
  where (requester_id = v_uid and addressee_id = v_target)
     or (requester_id = v_target and addressee_id = v_uid);

  if v_existing.id is not null then
    if v_existing.status = 'accepted' then
      raise exception 'Zaten arkadaşsınız.';
    elsif v_existing.status = 'pending' then
      raise exception 'Bekleyen bir istek zaten var.';
    elsif v_existing.status = 'blocked' then
      raise exception 'Bu kullanıcıya istek gönderilemiyor.';
    else
      -- Reddedilmiş istek yeniden denenebilir: satır tazeleniyor.
      update public.friendships
      set requester_id = v_uid,
          addressee_id = v_target,
          status = 'pending',
          created_at = now(),
          responded_at = null
      where id = v_existing.id
      returning * into v_row;
    end if;
  else
    insert into public.friendships (requester_id, addressee_id)
    values (v_uid, v_target)
    returning * into v_row;
  end if;

  select username into v_me from public.profiles where id = v_uid;

  perform public.notify(
    v_target,
    'friend_request',
    coalesce(v_me, 'Bir kullanıcı') || ' sana arkadaşlık isteği gönderdi',
    'İsteği arkadaşlar sayfasından yanıtlayabilirsin.',
    v_row.id
  );

  return v_row;
end;
$$;

revoke all on function public.send_friend_request(text) from public;
revoke all on function public.send_friend_request(text) from anon;
grant execute on function public.send_friend_request(text) to authenticated;

create or replace function public.respond_friend_request(
  p_id uuid,
  p_accept boolean
)
returns public.friendships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.friendships;
  v_me text;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  select * into v_row from public.friendships where id = p_id;

  if v_row.id is null then
    raise exception 'İstek bulunamadı.';
  end if;

  -- Yalnızca isteğin gönderildiği kişi yanıtlayabilir.
  if v_row.addressee_id <> v_uid then
    raise exception 'Bu isteği yanıtlama yetkin yok.';
  end if;

  if v_row.status <> 'pending' then
    raise exception 'Bu istek zaten yanıtlanmış.';
  end if;

  update public.friendships
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_id
  returning * into v_row;

  if p_accept then
    select username into v_me from public.profiles where id = v_uid;
    perform public.notify(
      v_row.requester_id,
      'friend_accepted',
      coalesce(v_me, 'Bir kullanıcı') || ' arkadaşlık isteğini kabul etti',
      'Artık sıralamada birbirinizi görebilirsiniz.',
      v_row.id
    );
  end if;

  return v_row;
end;
$$;

revoke all on function public.respond_friend_request(uuid, boolean) from public;
revoke all on function public.respond_friend_request(uuid, boolean) from anon;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

create or replace function public.remove_friend(p_user_id uuid)
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

  -- Satır tamamen siliniyor: "arkadaş değiliz" durumu için ayrı bir kayıt
  -- tutmanın faydası yok ve silinen satır yeniden istek göndermeyi açıyor.
  delete from public.friendships
  where (requester_id = v_uid and addressee_id = p_user_id)
     or (requester_id = p_user_id and addressee_id = v_uid);
end;
$$;

revoke all on function public.remove_friend(uuid) from public;
revoke all on function public.remove_friend(uuid) from anon;
grant execute on function public.remove_friend(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Profil kartı (gizlilik sınırı)
-- ---------------------------------------------------------------------------

/*
  Başka bir kullanıcının profil kartı.

  Arkadaşsa tam kart (rozet sayısı, tamamlanan görev, toplam XP); değilse
  yalnızca kullanıcı adı, avatar ve seviye. Gizlilik kararı tek yerde:
  arayüzde "arkadaş mı" kontrolü yapıp alanları gizlemek, veriyi zaten
  göndermiş olmak demekti.
*/
create or replace function public.get_profile_card(p_username text)
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  level integer,
  is_friend boolean,
  request_status text,
  total_xp integer,
  badge_count integer,
  completed_tasks integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_target uuid;
  v_friend boolean;
  v_xp integer;
  v_status text;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  select p.id into v_target
  from public.profiles p
  where p.username = trim(p_username);

  if v_target is null then
    raise exception 'Bu kullanıcı adı bulunamadı.';
  end if;

  v_friend := public.are_friends(v_uid, v_target);

  select f.status into v_status
  from public.friendships f
  where (f.requester_id = v_uid and f.addressee_id = v_target)
     or (f.requester_id = v_target and f.addressee_id = v_uid);

  select coalesce(sum(x.amount), 0)::integer into v_xp
  from public.xp_transactions x where x.user_id = v_target;

  return query
  select
    v_target,
    p.username::text,
    p.avatar_url,
    (select l.level from public.level_from_xp(v_xp) l),
    v_friend,
    coalesce(v_status, 'none'),
    -- Arkadaş değilse ayrıntılar boş dönüyor.
    case when v_friend then v_xp else null end,
    case when v_friend then
      (select count(*)::integer from public.user_badges ub where ub.user_id = v_target)
    else null end,
    case when v_friend then
      (select count(*)::integer from public.task_submissions s
        where s.user_id = v_target and s.status = 'approved')
    else null end
  from public.profiles p
  where p.id = v_target;
end;
$$;

revoke all on function public.get_profile_card(text) from public;
revoke all on function public.get_profile_card(text) from anon;
grant execute on function public.get_profile_card(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Arkadaş listesi
-- ---------------------------------------------------------------------------

create or replace function public.list_friends()
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  level integer,
  weekly_xp integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_since timestamptz;
begin
  if v_uid is null then
    return;
  end if;

  v_since := public.period_start('week');

  return query
  select
    p.id,
    p.username::text,
    p.avatar_url,
    (select l.level from public.level_from_xp(
      coalesce((select sum(x.amount)::integer from public.xp_transactions x where x.user_id = p.id), 0)
    ) l),
    coalesce(
      (select sum(x.amount)::integer from public.xp_transactions x
        where x.user_id = p.id and x.created_at >= v_since),
      0
    )
  from public.profiles p
  where p.id in (select public.my_friend_ids())
  order by p.username;
end;
$$;

revoke all on function public.list_friends() from public;
revoke all on function public.list_friends() from anon;
grant execute on function public.list_friends() to authenticated;

/** Bekleyen istekler: bana gelenler ve benim gönderdiklerim. */
create or replace function public.list_friend_requests()
returns table (
  id uuid,
  direction text,
  username text,
  avatar_url text,
  created_at timestamptz
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
    f.id,
    case when f.addressee_id = v_uid then 'incoming' else 'outgoing' end,
    p.username::text,
    p.avatar_url,
    f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = case when f.addressee_id = v_uid then f.requester_id else f.addressee_id end
  where f.status = 'pending'
    and v_uid in (f.requester_id, f.addressee_id)
  order by f.created_at desc;
end;
$$;

revoke all on function public.list_friend_requests() from public;
revoke all on function public.list_friend_requests() from anon;
grant execute on function public.list_friend_requests() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.friendships enable row level security;

-- Kullanıcı yalnızca taraf olduğu ilişkileri görüyor.
create policy friendships_select_own on public.friendships
  for select to authenticated using (
    (select auth.uid()) in (requester_id, addressee_id)
  );

-- Yazma yalnızca yukarıdaki fonksiyonlardan.
revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;
