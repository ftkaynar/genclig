-- M33 testi: takım sıralamasında kapsam ve dönem.
--
-- Senaryolar:
--   1. Türkiye kapsamı her iki takımı da görüyor
--   2. İl kapsamı YALNIZ çağıranın ilindeki takımı görüyor
--   3. İlçe kapsamı daha da daraltıyor
--   4. Kaptanın konumu yoksa takım daraltılmış kapsamda GÖRÜNMÜYOR
--   5. Dönem filtresi çalışıyor (eski XP haftalıkta sayılmıyor)
--   6. Geçersiz kapsam reddediliyor
--   7. Geçersiz dönem reddediliyor
--   8. Tek imza kaldı (eski tek parametreli sürüm yok)
--
-- Çalıştırma:
--   docker exec -i supabase_db_genclig psql -U postgres -d postgres \
--     < supabase/tests/team_leaderboard_scope.sql

\set ON_ERROR_STOP off
\timing off

begin;

create temporary table t_result (senaryo text, sonuc text) on commit drop;
create temporary table t_ids (k text primary key, v uuid) on commit drop;

-- ---------------------------------------------------------------------------
-- Hazırlık: iki ilde iki takım + konumsuz kaptanlı üçüncü takım
-- ---------------------------------------------------------------------------

do $$
declare
  v_me uuid := gen_random_uuid();      -- çağıran: Ankara / ilçe A
  v_cap_a uuid := gen_random_uuid();   -- Ankara kaptanı, aynı ilçe
  v_cap_b uuid := gen_random_uuid();   -- İstanbul kaptanı
  v_cap_c uuid := gen_random_uuid();   -- konumsuz kaptan
  v_ank smallint;
  v_ist smallint;
  v_d1 bigint;
  v_d2 bigint;
  v_ta uuid; v_tb uuid; v_tc uuid;
begin
  select id into v_ank from public.provinces where name = 'Ankara';
  select id into v_ist from public.provinces where name = 'İstanbul';

  select id into v_d1 from public.districts where province_id = v_ank
  order by id limit 1;
  select id into v_d2 from public.districts where province_id = v_ank
  order by id offset 1 limit 1;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values
    (v_me,    '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'tl-me@example.com', '', now(), now(), now()),
    (v_cap_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'tl-a@example.com', '', now(), now(), now()),
    (v_cap_b, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'tl-b@example.com', '', now(), now(), now()),
    (v_cap_c, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'tl-c@example.com', '', now(), now(), now());

  insert into public.profiles (id, username, province_id, district_id)
  values
    (v_me,    'tlme', v_ank, v_d1),
    (v_cap_a, 'tla',  v_ank, v_d1),
    (v_cap_b, 'tlb',  v_ist, null),
    (v_cap_c, 'tlc',  null,  null)
  on conflict (id) do update
    set province_id = excluded.province_id,
        district_id = excluded.district_id;

  insert into public.teams (name, captain_id, invite_code)
  values ('Ankara Takimi', v_cap_a, 'TLA' || substr(md5(random()::text), 1, 5))
  returning id into v_ta;
  insert into public.teams (name, captain_id, invite_code)
  values ('Istanbul Takimi', v_cap_b, 'TLB' || substr(md5(random()::text), 1, 5))
  returning id into v_tb;
  insert into public.teams (name, captain_id, invite_code)
  values ('Konumsuz Takim', v_cap_c, 'TLC' || substr(md5(random()::text), 1, 5))
  returning id into v_tc;

  insert into public.team_members (team_id, user_id)
  values (v_ta, v_cap_a), (v_tb, v_cap_b), (v_tc, v_cap_c);

  -- BU HAFTA kazanılan XP.
  insert into public.xp_transactions (user_id, amount, reason, created_at)
  values
    (v_cap_a, 500, 'adjustment', now()),
    (v_cap_b, 400, 'adjustment', now()),
    (v_cap_c, 300, 'adjustment', now());

  -- ESKİ XP: haftalıkta sayılmamalı, yıllıkta sayılmalı.
  insert into public.xp_transactions (user_id, amount, reason, created_at)
  values (v_cap_a, 9000, 'adjustment', now() - interval '20 days');

  insert into t_ids values ('me', v_me), ('ta', v_ta), ('tb', v_tb),
                           ('tc', v_tc);
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 1-4 — kapsam
-- ---------------------------------------------------------------------------

do $$
declare
  v_me uuid := (select v from t_ids where k = 'me');
  v_ta uuid := (select v from t_ids where k = 'ta');
  v_tb uuid := (select v from t_ids where k = 'tb');
  v_tc uuid := (select v from t_ids where k = 'tc');
  v_tr integer; v_il integer; v_ilce integer;
  v_ist_gorundu integer; v_konumsuz_il integer;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_me::text, 'role', 'authenticated')::text, true);

  -- Türkiye: üçü de
  select count(*) into v_tr
  from public.leaderboard_teams('week', 'turkiye') r
  where r.team_id in (v_ta, v_tb, v_tc);

  insert into t_result values (
    '1-turkiye ucunu de goruyor',
    case when v_tr = 3 then 'GECTI' else 'HATA: ' || v_tr || ' takim' end
  );

  -- İl (Ankara): yalnız Ankara takımı
  select count(*) into v_il
  from public.leaderboard_teams('week', 'il') r
  where r.team_id in (v_ta, v_tb, v_tc);

  select count(*) into v_ist_gorundu
  from public.leaderboard_teams('week', 'il') r
  where r.team_id = v_tb;

  insert into t_result values (
    '2-il kapsami daraltiyor',
    case when v_il = 1 and v_ist_gorundu = 0 then 'GECTI'
         else 'HATA: gorunen=' || v_il || ' istanbul=' || v_ist_gorundu end
  );

  -- İlçe: yine yalnız Ankara takımı (aynı ilçe)
  select count(*) into v_ilce
  from public.leaderboard_teams('week', 'ilce') r
  where r.team_id in (v_ta, v_tb, v_tc);

  insert into t_result values (
    '3-ilce kapsami calisiyor',
    case when v_ilce = 1 then 'GECTI' else 'HATA: ' || v_ilce || ' takim' end
  );

  -- Konumsuz kaptan: daraltılmış kapsamda görünmemeli
  select count(*) into v_konumsuz_il
  from public.leaderboard_teams('week', 'il') r
  where r.team_id = v_tc;

  insert into t_result values (
    '4-konumsuz kaptan il kapsaminda yok',
    case when v_konumsuz_il = 0 then 'GECTI' else 'HATA: gorundu' end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 5 — dönem
-- ---------------------------------------------------------------------------

do $$
declare
  v_me uuid := (select v from t_ids where k = 'me');
  v_ta uuid := (select v from t_ids where k = 'ta');
  v_hafta integer;
  v_yil integer;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_me::text, 'role', 'authenticated')::text, true);

  select r.total_xp into v_hafta
  from public.leaderboard_teams('week', 'turkiye') r where r.team_id = v_ta;

  select r.total_xp into v_yil
  from public.leaderboard_teams('year', 'turkiye') r where r.team_id = v_ta;

  /*
    Haftalıkta 500 (yalnız bugünkü), yıllıkta 9500 (20 gün öncekiyle
    birlikte). Aynı sayı çıksaydı dönem filtresi çalışmıyor demekti.
  */
  insert into t_result values (
    '5-donem filtresi sonucu degistiriyor',
    case when v_hafta = 500 and v_yil = 9500 then 'GECTI'
         else 'HATA: hafta=' || coalesce(v_hafta, -1)
              || ' yil=' || coalesce(v_yil, -1) || ' (500/9500 olmali)' end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 6-7 — doğrulama
-- ---------------------------------------------------------------------------

do $$
declare
  v_me uuid := (select v from t_ids where k = 'me');
  v_kapsam text := '';
  v_donem text := '';
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_me::text, 'role', 'authenticated')::text, true);

  begin
    perform * from public.leaderboard_teams('week', 'galaksi');
  exception when others then
    v_kapsam := sqlerrm;
  end;

  insert into t_result values (
    '6-gecersiz kapsam reddediliyor',
    case when v_kapsam like '%Geçersiz kapsam%' then 'GECTI'
         else 'HATA: ' || coalesce(nullif(v_kapsam, ''), 'hic hata yok') end
  );

  begin
    perform * from public.leaderboard_teams('decade', 'turkiye');
  exception when others then
    v_donem := sqlerrm;
  end;

  insert into t_result values (
    '7-gecersiz donem reddediliyor',
    case when v_donem like '%Geçersiz dönem%' then 'GECTI'
         else 'HATA: ' || coalesce(nullif(v_donem, ''), 'hic hata yok') end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 8 — tek imza
-- ---------------------------------------------------------------------------

do $$
declare
  v_imza integer;
begin
  select count(*) into v_imza from pg_proc where proname = 'leaderboard_teams';

  insert into t_result values (
    '8-tek imza kaldi',
    case when v_imza = 1 then 'GECTI'
         else 'HATA: ' || v_imza || ' imza (PostgREST belirsizligi)' end
  );
end;
$$;

select senaryo, sonuc from t_result order by senaryo;

select
  count(*) filter (where sonuc like 'HATA%') as hata,
  count(*) filter (where sonuc = 'GECTI') as gecti
from t_result;

rollback;
