-- M34c (D35 FAZ SZ): sıralama dönemi 'year' -> 'season' + sezon ödülleri.

/*
  NEDEN.

  D33'te sezonlar geldi (seasons tablosu, FUT kart etiketi, sıralama
  başlığındaki ibare) ama sıralama DÖNEMİ hâlâ takvim yılıydı. Kullanıcı
  ekranın üstünde "Sezon 1" yazısını görüp hemen altındaki hapta "Bu Yıl"
  seçiyordu: iki farklı zaman kavramı yan yana duruyor ve hangisinin
  listeyi belirlediği anlaşılmıyordu. Sezon, yönetici tarafından
  tanımlanan tek gerçek yarış penceresi; dönem de o olmalı.

  'year' KALDIRILIYOR. İki eşanlamlı uzun dönem tutmak ödül ayarları
  matrisini gereksiz büyütürdü (2 kapsam x 4 dönem x 3 sıra = 24 satır,
  altısı hiç kullanılmayan). Arayüz ?donem=year isteğini season'a
  çeviriyor, bu yüzden fonksiyonların 'year'ı reddetmesi eski bir
  bağlantıyı kırmıyor.

  Aktif sezon yoksa dönem BOŞ sonuç veriyor, hata değil: yönetici iki
  sezon arasında boşluk bırakabilir ve o boşlukta sıralama ekranının
  çökmesi gerekmiyor.
*/

-- ===========================================================================
-- 1. period_start: 'season' penceresi
-- ===========================================================================

/*
  Sezon penceresi active_season()'dan (D33'te zaten var; security definer
  olduğu için RLS takılmıyor).

  Aktif sezon yokken 'infinity' dönüyor: hiçbir işlem pencereye girmiyor,
  liste boş kalıyor. '-infinity' (her şey dahil) denendi ve elendi —
  sezon yokken tüm zamanların sıralamasını "Bu Sezon" diye göstermek
  düpedüz yanlış bilgi olurdu.
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
    when 'season' then
      coalesce(
        (select s.starts_at from public.active_season() s),
        'infinity'::timestamptz
      )
    else '-infinity'::timestamptz
  end;
$$;

-- ===========================================================================
-- 2. Sıralama fonksiyonları 'season' kabul ediyor, 'year' etmiyor
-- ===========================================================================

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
  -- 'year' M34c ile listeden çıktı; yerini 'season' aldı.
  if p_period not in ('week', 'month', 'season', 'all') then
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

/*
  my_rank'a dönem BEYAZ LİSTESİ eklendi.

  ÖLÇÜLEN SORUN: bu fonksiyonda hiç kontrol yoktu, doğrudan
  period_start() çağırıyordu. Bilinmeyen bir dönem sessizce
  '-infinity'ye, yani tüm zamanlara düşüyordu; leaderboard_top ise aynı
  istekte 'Geçersiz dönem.' raise ediyordu. Liste ile "benim sıram"
  farklı pencerelerden beslenebiliyordu. Üç fonksiyon artık aynı dönem
  listesini kabul ediyor.
*/
create or replace function public.leaderboard_my_rank(
  p_scope text default 'turkiye',
  p_period text default 'all'
)
returns table (rank integer, total_xp integer, scope_size integer)
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

  if p_period not in ('week', 'month', 'season', 'all') then
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

revoke all on function public.leaderboard_my_rank(text, text) from public, anon;
grant execute on function public.leaderboard_my_rank(text, text) to authenticated;

create or replace function public.leaderboard_teams(
  p_period text default 'week',
  p_scope text default 'turkiye'
)
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
  v_uid uuid := (select auth.uid());
  v_since timestamptz;
  v_province smallint;
  v_district bigint;
  v_neighborhood bigint;
begin
  if p_period not in ('week', 'month', 'season', 'all') then
    raise exception 'Geçersiz dönem.';
  end if;

  /*
    Kapsam listesi leaderboard_top ile AYNI — 'arkadaslar' hariç.
    Arkadaş kapsamı takımda anlamsız: takım zaten bir grup.
  */
  if p_scope not in ('turkiye', 'il', 'ilce', 'mahalle') then
    raise exception 'Geçersiz kapsam.';
  end if;

  v_since := public.period_start(p_period);

  -- Çağıranın konumu: "benim ilimdeki takımlar" bu satıra dayanıyor.
  select p.province_id, p.district_id, p.neighborhood_id
  into v_province, v_district, v_neighborhood
  from public.profiles p where p.id = v_uid;

  return query
  with scoped as (
    select t.id, t.name, t.icon
    from public.teams t
    join public.profiles cap on cap.id = t.captain_id
    where
      p_scope = 'turkiye'
      or (p_scope = 'il' and v_province is not null
          and cap.province_id = v_province)
      or (p_scope = 'ilce' and v_district is not null
          and cap.district_id = v_district)
      or (p_scope = 'mahalle' and v_neighborhood is not null
          and cap.neighborhood_id = v_neighborhood)
  ),
  totals as (
    select
      s.id,
      s.name,
      s.icon,
      (select count(*)::integer from public.team_members m where m.team_id = s.id)
        as members,
      coalesce(sum(x.amount), 0)::integer as xp
    from scoped s
    left join public.team_members tm on tm.team_id = s.id
    left join public.xp_transactions x
      on x.user_id = tm.user_id and x.created_at >= v_since
    group by s.id, s.name, s.icon
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

revoke all on function public.leaderboard_teams(text, text) from public, anon;
grant execute on function public.leaderboard_teams(text, text) to authenticated;

-- ===========================================================================
-- 3. Ödül ayarları: 'season' dönemi
-- ===========================================================================

alter table public.leaderboard_reward_settings
  drop constraint if exists leaderboard_reward_settings_period_check;

alter table public.leaderboard_reward_settings
  add constraint leaderboard_reward_settings_period_check
  check (period in ('week', 'month', 'season'));

/*
  Sezon ödülleri aylıktan BELİRGİN ŞEKİLDE büyük.

  Sezon aylardan oluşuyor; aylık ödülle aynı olsa bir sezon boyunca
  birinci kalmak bir ay birinci olmakla aynı değerde görünürdü ve uzun
  soluklu yarışın anlamı kalmazdı. Takım değerleri bireyselin yarısı:
  takımda her üyeye SABİT miktar yazılıyor, bölüştürülmüyor (M29b
  kuralı); on kişilik bir takımda bireysel değerin tamamını vermek
  ekonomiyi şişirirdi.

  Tohum idempotent: (scope, period, rank) üçlüsü varsa dokunmuyor. Bu
  sayede migration yeniden koşsa da yöneticinin elle değiştirdiği
  miktarlar geri gelmiyor.
*/
insert into public.leaderboard_reward_settings (scope, period, rank, xp, token, active)
select v.scope, v.period, v.rank, v.xp, v.token, v.active
from (values
  ('turkiye',  'season', 1::smallint, 3000, 1500, true),
  ('turkiye',  'season', 2::smallint, 1800,  900, true),
  ('turkiye',  'season', 3::smallint,  900,  450, true),
  ('takimlar', 'season', 1::smallint, 1500,  750, true),
  ('takimlar', 'season', 2::smallint,  900,  450, true),
  ('takimlar', 'season', 3::smallint,  450,  220, true)
) as v(scope, period, rank, xp, token, active)
where not exists (
  select 1 from public.leaderboard_reward_settings s
  where s.scope = v.scope and s.period = v.period and s.rank = v.rank
);

-- ===========================================================================
-- 4. Sezon dağıtımı
-- ===========================================================================

/*
  period_key = 'sezon-<id>'.

  Tarih tabanlı bir anahtar (yıl-çeyrek gibi) denendi ve elendi: sezon
  tarihleri yönetici tarafından serbestçe ayarlanıyor ve iki sezon aynı
  çeyreğe düşebiliyor — anahtar tekilliğini kaybederdi. Sezon kimliği
  tekil ve değişmez. Aynı biçim sezon rozetinin slug'ında da kullanılıyor
  (settle_season_badges), yani iki yerde tek kural var.

  leaderboard_period_range 'season' anahtarını çözemiyor (hafta/ay
  biçimlerini bekliyor), bu yüzden pencere doğrudan seasons tablosundan
  okunuyor.
*/
create or replace function public.award_leaderboard_rewards(
  p_scope text,
  p_period text,
  p_period_key text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_setting public.leaderboard_reward_settings;
  v_awarded integer := 0;
  v_from timestamptz;
  v_to timestamptz;
  v_label text;
  v_winner uuid;
  v_member record;
  v_inserted uuid;
begin
  if p_scope not in ('turkiye', 'takimlar')
     or p_period not in ('week', 'month', 'season')
     or p_period_key is null then
    return 0;
  end if;

  if p_period = 'season' then
    select s.starts_at, s.ends_at, s.name
    into v_from, v_to, v_label
    from public.seasons s
    where 'sezon-' || s.id = p_period_key;
  else
    select r.starts_at, r.ends_at into v_from, v_to
    from public.leaderboard_period_range(p_period, p_period_key) r;
    v_label := p_period_key;
  end if;

  if v_from is null then
    return 0;
  end if;

  for v_setting in
    select * from public.leaderboard_reward_settings
    where scope = p_scope and period = p_period and active
    order by rank
  loop
    v_winner := null;

    if p_scope = 'turkiye' then
      select q.user_id into v_winner
      from (
        select x.user_id, sum(x.amount) as xp
        from public.xp_transactions x
        join public.profiles p on p.id = x.user_id
        where x.created_at >= v_from and x.created_at < v_to
          and p.username is not null
          -- Ödül işlemleri sıralamayı beslemiyor: kazanan kendi
          -- ödülüyle bir sonraki dönemde de öne geçmemeli.
          and x.reason <> 'leaderboard_reward'
        group by x.user_id
        having sum(x.amount) > 0
        order by sum(x.amount) desc, x.user_id asc
        offset (v_setting.rank - 1) limit 1
      ) q;
    else
      select q.team_id into v_winner
      from (
        select tm.team_id, sum(x.amount) as xp
        from public.xp_transactions x
        join public.team_members tm on tm.user_id = x.user_id
        where x.created_at >= v_from and x.created_at < v_to
          and x.reason <> 'leaderboard_reward'
        group by tm.team_id
        having sum(x.amount) > 0
        order by sum(x.amount) desc, tm.team_id asc
        offset (v_setting.rank - 1) limit 1
      ) q;
    end if;

    if v_winner is null then
      continue;
    end if;

    insert into public.leaderboard_reward_awards
      (scope, period, period_key, rank, user_id, team_id, xp, token)
    values (
      p_scope, p_period, p_period_key, v_setting.rank,
      case when p_scope = 'turkiye' then v_winner end,
      case when p_scope = 'takimlar' then v_winner end,
      v_setting.xp, v_setting.token
    )
    on conflict (scope, period, period_key, rank) do nothing
    returning id into v_inserted;

    -- Kayıt yazılmadıysa bu dönem zaten dağıtılmış: puan da yazılmıyor.
    if v_inserted is null then
      continue;
    end if;

    if p_scope = 'turkiye' then
      if v_setting.xp > 0 then
        insert into public.xp_transactions (user_id, amount, reason)
        values (v_winner, v_setting.xp, 'leaderboard_reward');
      end if;
      if v_setting.token > 0 then
        insert into public.coin_transactions (user_id, amount, reason)
        values (v_winner, v_setting.token, 'leaderboard_reward');
      end if;

      /*
        Bildirimde v_label: sezonda "Sezon 1", hafta/ayda dönem
        anahtarı. Ham anahtarı göstermek ("sezon-1 dönemi") kullanıcıya
        hiçbir şey söylemiyordu.
      */
      perform public.notify(
        v_winner,
        'leaderboard_reward',
        case v_setting.rank
          when 1 then 'Zirvedesin! Sıralama ödülün hazır'
          when 2 then 'İkinci oldun! Sıralama ödülün hazır'
          else 'Üçüncü oldun! Sıralama ödülün hazır'
        end,
        format('%s dönemi %s. sırası: +%s XP +%s Token',
               v_label, v_setting.rank, v_setting.xp, v_setting.token)
      );
    else
      -- Her üyeye SABİT miktar (bölüştürme değil; gerekçe seed notunda).
      for v_member in
        select user_id from public.team_members where team_id = v_winner
      loop
        if v_setting.xp > 0 then
          insert into public.xp_transactions (user_id, amount, reason)
          values (v_member.user_id, v_setting.xp, 'leaderboard_reward');
        end if;
        if v_setting.token > 0 then
          insert into public.coin_transactions (user_id, amount, reason)
          values (v_member.user_id, v_setting.token, 'leaderboard_reward');
        end if;

        perform public.notify(
          v_member.user_id,
          'leaderboard_reward',
          'Takımın sıralamada ' || v_setting.rank || '. oldu!',
          format('%s dönemi: +%s XP +%s Token',
                 v_label, v_setting.xp, v_setting.token)
        );
      end loop;
    end if;

    v_awarded := v_awarded + 1;
  end loop;

  if v_awarded > 0 then
    perform public.log_audit(
      null, 'leaderboard.award', 'leaderboard', p_period_key,
      jsonb_build_object('scope', p_scope, 'period', p_period,
                         'awarded', v_awarded)
    );
  end if;

  return v_awarded;
end;
$$;

revoke all on function public.award_leaderboard_rewards(text, text, text)
  from public, anon;

/*
  Biten sezonun ödülleri sezon rozetiyle AYNI yerde dağıtılıyor.

  settle_season_badges günlük cron'da koşuyor ve sezonun bittiğini zaten
  burada tespit ediyor; ikinci bir cron işi aynı soruyu iki kez sormak
  olurdu.

  SIRA ÖNEMLİ: ödül çağrısı badge_awarded bayrağı kalkmadan ÖNCE. Bayrak
  döngünün sonunda true'ya çekiliyor ve sezonu "işlendi" sayıyor; ödül
  dağıtımı bayraktan sonra denenseydi bir daha hiç çalışmazdı. Ödülün
  kendi kapısı da var (leaderboard_reward_awards UNIQUE), yani bu döngü
  bir şekilde iki kez koşsa da ödül tek kez yazılıyor.
*/
create or replace function public.settle_season_badges()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season record;
  v_badge uuid;
  v_slug text;
  v_user record;
  v_total integer := 0;
begin
  for v_season in
    select * from public.seasons
    where ends_at <= now() and badge_awarded = false
    order by starts_at
  loop
    v_slug := 'sezon-' || v_season.id;

    -- Sezon sıralaması ödülleri (bireysel + takım).
    perform public.award_leaderboard_rewards('turkiye', 'season', v_slug);
    perform public.award_leaderboard_rewards('takimlar', 'season', v_slug);

    select id into v_badge from public.badges where slug = v_slug;

    if v_badge is null then
      insert into public.badges
        (slug, name, description, icon, criteria, xp_bonus, coin_bonus, status)
      values (
        v_slug,
        v_season.name,
        v_season.name || ' boyunca en az bir görev tamamladın.',
        'trophy',
        jsonb_build_object('type', 'season', 'season_id', v_season.id),
        0,
        0,
        'active'
      )
      returning id into v_badge;
    end if;

    for v_user in
      select distinct s.user_id
      from public.task_submissions s
      where s.status = 'approved'
        and s.created_at >= v_season.starts_at
        and s.created_at < v_season.ends_at
    loop
      insert into public.user_badges (user_id, badge_id)
      values (v_user.user_id, v_badge)
      on conflict do nothing;

      -- Bildirim yalnız GERÇEKTEN yeni rozet kazanana.
      if found then
        perform public.notify(
          v_user.user_id,
          'badge_earned',
          v_season.name || ' rozetini kazandın',
          v_season.name || ' boyunca görev yaptın. Rozet profilinde.',
          v_badge
        );
        v_total := v_total + 1;
      end if;
    end loop;

    update public.seasons
    set badge_awarded = true, status = 'ended'
    where id = v_season.id;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.settle_season_badges() from public, anon;
grant execute on function public.settle_season_badges() to authenticated;
