-- M29b testi: dönem sonu sıralama ödülleri.
--
-- Senaryolar:
--   1. Ayarlar seed edildi
--   2. Dağıtım ilk çağrıda kazananlara puan + bildirim yazıyor
--   3. İKİNCİ çağrı hiçbir şey yazmıyor (idempotent)
--   4. Puanlar 'leaderboard_reward' gerekçesiyle yazılmış
--   5. Normal kullanıcı ayarları OKUYOR ama DEĞİŞTİREMİYOR
--   6. Kullanıcı yalnız kendi ödül kaydını görüyor
--
-- Çalıştırma:
--   docker exec -i supabase_db_genclig psql -U postgres -d postgres \
--     < supabase/tests/leaderboard_rewards.sql

\set ON_ERROR_STOP off
\timing off

begin;

create temporary table t_result (senaryo text, olcum text, deger text)
  on commit drop;
create temporary table t_ids (k text primary key, v uuid) on commit drop;

-- ---------------------------------------------------------------------------
-- Hazırlık: üç kullanıcı, farklı XP (sıralama oluşsun)
-- ---------------------------------------------------------------------------

do $$
declare
  v_ids uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_i integer;
  v_task uuid;
begin
  select id into v_task from public.tasks limit 1;

  for v_i in 1..3 loop
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, created_at, updated_at)
    values (v_ids[v_i], '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'lb' || v_i || '@example.com', '', now(), now(), now());

    /*
      do UPDATE sart: profil satiri auth.users tetikleyicisiyle
      username NULL olarak olusuyor ve `do nothing` onu duzeltmiyordu.
      Bu yuzden siralama sorgusu (p.username is not null) kullanicilari
      hic gormedi ve testin TAMAMI 0/0 ile sessizce gecti.
    */
    insert into public.profiles (id, username) values (v_ids[v_i], 'lb' || v_i)
    on conflict (id) do update set username = excluded.username;

    -- Sıralama için XP: 1. en çok
    insert into public.xp_transactions (user_id, amount, reason, created_at)
    values (v_ids[v_i], 1000 - v_i * 100, 'task',
            date_trunc('week', now() at time zone 'Europe/Istanbul') - interval '3 days');

    insert into t_ids values ('u' || v_i, v_ids[v_i]);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 1 — ayarlar
-- ---------------------------------------------------------------------------

insert into t_result
select '1-ayarlar', 'seed satiri',
       count(*)::text from public.leaderboard_reward_settings;

insert into t_result
select '1-ayarlar',
       case when count(*) = 12 then 'GECTI: 12 ayar (2 kapsam x 2 donem x 3 sira)'
            else 'HATA: ' || count(*) end, ''
from public.leaderboard_reward_settings;

-- ---------------------------------------------------------------------------
-- SENARYO 2-3-4 — dağıtım ve idempotentlik
-- ---------------------------------------------------------------------------

do $$
declare
  v_key text := public.leaderboard_period_key('week', 1);
  v_first integer;
  v_second integer;
  v_awards integer;
  v_xp integer;
  v_notif integer;
begin
  v_first := public.award_leaderboard_rewards('turkiye', 'week', v_key);
  v_second := public.award_leaderboard_rewards('turkiye', 'week', v_key);

  select count(*) into v_awards from public.leaderboard_reward_awards
  where scope = 'turkiye' and period = 'week' and period_key = v_key;

  select count(*) into v_xp from public.xp_transactions
  where reason = 'leaderboard_reward';

  select count(*) into v_notif from public.notifications
  where type = 'leaderboard_reward';

  insert into t_result values
    ('2-dagitim', 'donem anahtari', v_key),
    ('2-dagitim', '1. cagri / 2. cagri', v_first || ' / ' || v_second),
    ('3-idempotent', 'award kaydi', v_awards::text),
    ('4-islem', 'leaderboard_reward xp satiri', v_xp::text),
    ('2-dagitim', 'bildirim', v_notif::text);

  insert into t_result values
    ('3-idempotent',
     case when v_second = 0 and v_awards = v_first
          then 'GECTI: ikinci cagri hicbir sey yazmadi'
          else 'HATA: ikinci cagri ' || v_second || ', kayit ' || v_awards end, '');

  insert into t_result values
    ('4-islem',
     case when v_xp = v_first
          then 'GECTI: puan bir kez yazildi'
          else 'HATA: xp satiri ' || v_xp || ', kazanan ' || v_first end, '');
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 5 — ayar okuma açık, yazma kapalı
-- ---------------------------------------------------------------------------

do $$
declare
  v_u uuid := (select v from t_ids where k = 'u1');
  v_read integer;
  v_wrote boolean := false;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_u::text, 'role', 'authenticated')::text, true);

  select count(*) into v_read from public.leaderboard_reward_settings;

  begin
    update public.leaderboard_reward_settings set xp = 99999 where rank = 1;
    get diagnostics v_wrote = row_count;
    v_wrote := v_wrote;
  exception when others then
    v_wrote := false;
  end;

  perform set_config('role', 'postgres', true);

  insert into t_result values
    ('5-erisim', 'normal kullanici okudugu ayar', v_read::text),
    ('5-erisim',
     case when v_read = 12 and not v_wrote
          then 'GECTI: okuyor ama degistiremiyor'
          else 'HATA: okuma ' || v_read || ' yazma ' || v_wrote end, '');
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 6 — kendi ödül kaydını görüyor
-- ---------------------------------------------------------------------------

do $$
declare
  v_u1 uuid := (select v from t_ids where k = 'u1');
  v_u3 uuid := (select v from t_ids where k = 'u3');
  v_own integer;
  v_all integer;
begin
  perform set_config('role', 'authenticated', true);

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_u1::text, 'role', 'authenticated')::text, true);
  select count(*) into v_own from public.leaderboard_reward_awards;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_u3::text, 'role', 'authenticated')::text, true);
  select count(*) into v_all from public.leaderboard_reward_awards;

  perform set_config('role', 'postgres', true);

  insert into t_result values
    ('6-gorunurluk', 'u1 / u3 gordugu kayit', v_own || ' / ' || v_all),
    ('6-gorunurluk',
     case when v_own = 1 and v_all = 1
          then 'GECTI: herkes yalniz kendi odulunu goruyor'
          else 'HATA: u1=' || v_own || ' u3=' || v_all end, '');
end;
$$;

-- ---------------------------------------------------------------------------
-- Sonuç
-- ---------------------------------------------------------------------------

select senaryo, olcum, deger from t_result order by senaryo, olcum;

select
  count(*) filter (where olcum like 'HATA%' or deger like 'HATA%') as hata,
  count(*) filter (where olcum like 'GECTI%' or deger like 'GECTI%') as gecti
from t_result;

rollback;
