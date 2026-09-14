-- Sıralamaya "arkadaşlar" kapsamı.
--
-- Fonksiyonlar bütün olarak yeniden tanımlanıyor: kapsam koşulu sorgunun
-- ortasında, parça değiştirmenin yolu yok.

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
  if p_period not in ('week', 'month', 'all') then
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
        or (p_scope = 'mahalle' and v_neighborhood is not null and p.neighborhood_id = v_neighborhood)
        -- Arkadaş kapsamı çağıranın kendisini de içeriyor: kendi sırasını
        -- görmeden arkadaş sıralaması anlamsız.
        or (p_scope = 'arkadaslar' and (p.id = v_uid or p.id in (select public.my_friend_ids())))
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

revoke all on function public.leaderboard_top(text, text, integer) from public;
revoke all on function public.leaderboard_top(text, text, integer) from anon;
grant execute on function public.leaderboard_top(text, text, integer) to authenticated;

create or replace function public.leaderboard_my_rank(
  p_scope text default 'turkiye',
  p_period text default 'all'
)
returns table (
  rank integer,
  total_xp integer,
  scope_size integer
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
  if v_uid is null then
    return;
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
        or (p_scope = 'mahalle' and v_neighborhood is not null and p.neighborhood_id = v_neighborhood)
        or (p_scope = 'arkadaslar' and (p.id = v_uid or p.id in (select public.my_friend_ids())))
      )
  ),
  totals as (
    select s.id, s.username, coalesce(sum(x.amount), 0)::integer as xp
    from scoped s
    left join public.xp_transactions x
      on x.user_id = s.id and x.created_at >= v_since
    group by s.id, s.username
  ),
  ranked as (
    select t.id, t.xp,
           row_number() over (order by t.xp desc, t.username asc)::integer as r
    from totals t
    where t.xp > 0
  )
  select
    r.r,
    r.xp,
    (select count(*)::integer from ranked)
  from ranked r
  where r.id = v_uid;
end;
$$;

revoke all on function public.leaderboard_my_rank(text, text) from public;
revoke all on function public.leaderboard_my_rank(text, text) from anon;
grant execute on function public.leaderboard_my_rank(text, text) to authenticated;
