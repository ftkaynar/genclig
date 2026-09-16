-- M32a testi: Günün Görevi ve 2x ödül.
--
-- Senaryolar:
--   1. Otomatik seçim deterministik (aynı gün = aynı görev)
--   2. Dün seçilen görev bugün tekrar seçilmiyor
--   3. Vitrin görevinde ödül İKİ KATI
--   4. Vitrin dışı görevde ödül normal
--   5. Ertesi günün teslimi normal (vitrin güne bağlı)
--   6. İki kez onaylamak ikinci kez puan YAZMIYOR (idempotens)
--   7. Takım bonusu çarpılmıyor
--   8. Belediyeye bağlı görev otomatik seçime giremiyor
--
-- Çalıştırma:
--   docker exec -i supabase_db_genclig psql -U postgres -d postgres \
--     < supabase/tests/daily_spotlight.sql

\set ON_ERROR_STOP off
\timing off

begin;

create temporary table t_result (senaryo text, sonuc text) on commit drop;
create temporary table t_ids (k text primary key, v uuid) on commit drop;

-- ---------------------------------------------------------------------------
-- Hazırlık: bir kullanıcı + üç global görev
-- ---------------------------------------------------------------------------

do $$
declare
  v_u uuid := gen_random_uuid();
  v_cat smallint;
  v_a uuid;
  v_b uuid;
  v_mun_task uuid;
  v_mun uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'spotlight@example.com', '', now(), now(), now());

  insert into public.profiles (id, username)
  values (v_u, 'spotlightuser')
  on conflict (id) do update set username = excluded.username;

  select id into v_cat from public.task_categories order by id limit 1;
  select id into v_mun from public.municipalities order by id limit 1;

  -- GLOBAL görevler (municipality_id null): vitrin adayı.
  insert into public.tasks (title, description, type, category_id, verification,
                            difficulty, scope, xp, coin, status, municipality_id)
  values ('Vitrin A', 'test', 'continuous', v_cat, 'manual', 'easy',
          'individual', 100, 50, 'active', null)
  returning id into v_a;

  insert into public.tasks (title, description, type, category_id, verification,
                            difficulty, scope, xp, coin, status, municipality_id)
  values ('Vitrin B', 'test', 'continuous', v_cat, 'manual', 'easy',
          'individual', 100, 50, 'active', null)
  returning id into v_b;

  -- Belediyeye bağlı görev: vitrine ÇIKMAMALI.
  insert into public.tasks (title, description, type, category_id, verification,
                            difficulty, scope, xp, coin, status, municipality_id)
  values ('Belediye gorevi', 'test', 'continuous', v_cat, 'manual', 'easy',
          'individual', 100, 50, 'active', v_mun)
  returning id into v_mun_task;

  insert into t_ids values ('u', v_u), ('a', v_a), ('b', v_b),
                           ('mun', v_mun_task);
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 1-2 — otomatik seçim
-- ---------------------------------------------------------------------------

do $$
declare
  v_gun date := public.istanbul_day();
  v_1 uuid;
  v_2 uuid;
  v_dun uuid;
  v_bugun uuid;
begin
  -- Temiz sayfa: bu testin kendi günlerini kullan.
  delete from public.daily_spotlight where day >= v_gun - 1;

  v_1 := public.pick_daily_spotlight(v_gun);
  v_2 := public.pick_daily_spotlight(v_gun);

  insert into t_result values (
    '1-deterministik',
    case when v_1 is not null and v_1 = v_2 then 'GECTI'
         else 'HATA: ' || coalesce(v_1::text, 'null') || ' / '
              || coalesce(v_2::text, 'null') end
  );

  -- Dün/bugün ayrımı: aynı görev iki gün üst üste seçilmemeli.
  delete from public.daily_spotlight where day >= v_gun - 1;
  v_dun := public.pick_daily_spotlight(v_gun - 1);
  v_bugun := public.pick_daily_spotlight(v_gun);

  insert into t_result values (
    '2-dun ile ayni degil',
    case when v_dun is not null and v_bugun is not null and v_dun <> v_bugun
         then 'GECTI'
         else 'HATA: dun=' || coalesce(v_dun::text, 'null')
              || ' bugun=' || coalesce(v_bugun::text, 'null') end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 8 — belediye görevi vitrine çıkmıyor
-- ---------------------------------------------------------------------------

do $$
declare
  v_mun uuid := (select v from t_ids where k = 'mun');
  v_sayim integer;
begin
  select count(*) into v_sayim
  from public.daily_spotlight where task_id = v_mun;

  insert into t_result values (
    '8-belediye gorevi vitrinde degil',
    case when v_sayim = 0 then 'GECTI' else 'HATA: secildi' end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 3-7 — ödül çarpanı
-- ---------------------------------------------------------------------------

do $$
declare
  v_u uuid := (select v from t_ids where k = 'u');
  v_a uuid := (select v from t_ids where k = 'a');
  v_b uuid := (select v from t_ids where k = 'b');
  v_gun date := public.istanbul_day();
  v_sub_vitrin uuid;
  v_sub_normal uuid;
  v_sub_yarin uuid;
  v_xp integer;
  v_coin integer;
  v_satir integer;
begin
  -- Vitrini A'ya SABİTLE: test seçimin rastlantısına bağlı olmamalı.
  delete from public.daily_spotlight where day in (v_gun, v_gun + 1);
  insert into public.daily_spotlight (day, task_id) values (v_gun, v_a);

  -- ---- 3: vitrin görevinde teslim
  insert into public.task_submissions
    (task_id, user_id, status, period_key, created_at)
  values (v_a, v_u, 'approved', 'once', now())
  returning id into v_sub_vitrin;

  perform public.award_task_points(v_sub_vitrin);

  select amount into v_xp from public.xp_transactions
  where submission_id = v_sub_vitrin and reason = 'task';
  select amount into v_coin from public.coin_transactions
  where submission_id = v_sub_vitrin and reason = 'task';

  insert into t_result values (
    '3-vitrin gorevi 2x',
    case when v_xp = 200 and v_coin = 100 then 'GECTI'
         else 'HATA: xp=' || coalesce(v_xp, -1)
              || ' coin=' || coalesce(v_coin, -1) || ' (200/100 olmali)' end
  );

  -- ---- 6: ikinci kez ödüllendirme puan YAZMAMALI
  perform public.award_task_points(v_sub_vitrin);

  select count(*) into v_satir from public.xp_transactions
  where submission_id = v_sub_vitrin and reason = 'task';

  select amount into v_xp from public.xp_transactions
  where submission_id = v_sub_vitrin and reason = 'task';

  insert into t_result values (
    '6-idempotens: tek satir, tek miktar',
    case when v_satir = 1 and v_xp = 200 then 'GECTI'
         else 'HATA: satir=' || v_satir || ' xp=' || coalesce(v_xp, -1) end
  );

  -- ---- 4: vitrin DIŞI görevde normal ödül
  insert into public.task_submissions
    (task_id, user_id, status, period_key, created_at)
  values (v_b, v_u, 'approved', 'once', now())
  returning id into v_sub_normal;

  perform public.award_task_points(v_sub_normal);

  select amount into v_xp from public.xp_transactions
  where submission_id = v_sub_normal and reason = 'task';

  insert into t_result values (
    '4-vitrin disi normal',
    case when v_xp = 100 then 'GECTI'
         else 'HATA: xp=' || coalesce(v_xp, -1) || ' (100 olmali)' end
  );

  /*
    ---- 5: YARIN yapılan teslim, bugünün vitrininden yararlanmamalı.
    Çarpan teslimin tarihine bakıyor; yarın vitrin B'de olsa bile A'ya
    dünden gelen bir teslim 2x almamalı.
  */
  insert into public.task_submissions
    (task_id, user_id, status, period_key, created_at)
  values (v_a, v_u, 'approved', 'once', now() + interval '1 day')
  returning id into v_sub_yarin;

  perform public.award_task_points(v_sub_yarin);

  select amount into v_xp from public.xp_transactions
  where submission_id = v_sub_yarin and reason = 'task';

  insert into t_result values (
    '5-ertesi gun normal',
    case when v_xp = 100 then 'GECTI'
         else 'HATA: xp=' || coalesce(v_xp, -1) || ' (100 olmali)' end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 7 — takım bonusu çarpılmıyor
-- ---------------------------------------------------------------------------

do $$
declare
  v_cat smallint;
  v_t uuid;
  v_u1 uuid := gen_random_uuid();
  v_u2 uuid := gen_random_uuid();
  v_team uuid;
  v_gun date := public.istanbul_day();
  v_s1 uuid;
  v_s2 uuid;
  v_bonus integer;
  v_task_xp integer;
begin
  select id into v_cat from public.task_categories order by id limit 1;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values
    (v_u1, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'spot-t1@example.com', '', now(), now(), now()),
    (v_u2, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'spot-t2@example.com', '', now(), now(), now());

  insert into public.profiles (id, username)
  values (v_u1, 'spott1'), (v_u2, 'spott2')
  on conflict (id) do update set username = excluded.username;

  insert into public.tasks (title, description, type, category_id, verification,
                            difficulty, scope, xp, coin, status, municipality_id,
                            min_team_size, team_bonus_xp, team_bonus_coin)
  values ('Vitrin takim', 'test', 'continuous', v_cat, 'manual', 'easy',
          'team', 100, 50, 'active', null, 2, 40, 20)
  returning id into v_t;

  insert into public.teams (name, captain_id, invite_code)
  values ('Vitrin Takimi', v_u1, 'VTR' || substr(md5(random()::text), 1, 5))
  returning id into v_team;

  insert into public.team_members (team_id, user_id)
  values (v_team, v_u1), (v_team, v_u2);

  -- Takım görevini vitrine koy.
  delete from public.daily_spotlight where day = v_gun;
  insert into public.daily_spotlight (day, task_id) values (v_gun, v_t);

  insert into public.task_submissions
    (task_id, user_id, status, period_key, created_at)
  values (v_t, v_u1, 'approved', 'once', now()) returning id into v_s1;
  insert into public.task_submissions
    (task_id, user_id, status, period_key, created_at)
  values (v_t, v_u2, 'approved', 'once', now()) returning id into v_s2;

  perform public.award_task_points(v_s1);
  perform public.award_task_points(v_s2);

  select amount into v_task_xp from public.xp_transactions
  where submission_id = v_s1 and reason = 'task';

  select amount into v_bonus from public.xp_transactions
  where submission_id = v_s1 and reason = 'team_bonus';

  insert into t_result values (
    '7-gorev 2x, takim bonusu 1x',
    case when v_task_xp = 200 and v_bonus = 40 then 'GECTI'
         else 'HATA: gorev=' || coalesce(v_task_xp, -1)
              || ' bonus=' || coalesce(v_bonus, -1) || ' (200/40 olmali)' end
  );
end;
$$;

select senaryo, sonuc from t_result order by senaryo;

select
  count(*) filter (where sonuc like 'HATA%') as hata,
  count(*) filter (where sonuc = 'GECTI') as gecti
from t_result;

rollback;
