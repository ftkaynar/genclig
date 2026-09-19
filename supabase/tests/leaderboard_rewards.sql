-- M29b testi: dönem sonu sıralama ödülleri.
--
-- Senaryolar:
--   1. Ayarlar seed edildi (18 satır: hafta/ay/sezon x bireysel/takım)
--   2. Dağıtım ilk çağrıda kazananlara puan + bildirim yazıyor
--   3. İKİNCİ çağrı hiçbir şey yazmıyor (idempotent)
--   4. Puanlar 'leaderboard_reward' gerekçesiyle yazılmış
--   5. Normal kullanıcı ayarları OKUYOR ama DEĞİŞTİREMİYOR
--   6. Kullanıcı yalnız kendi ödül kaydını görüyor
--   7. 'season' dönemi aktif sezonun penceresini kullanıyor, 'year' reddediliyor
--   8. Sezon penceresi dışındaki XP sıralamaya girmiyor
--   9. Sezon dağıtımı idempotent; settle_season_badges biten sezonu dağıtıyor
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
       case when count(*) = 18 then 'GECTI: 18 ayar (2 kapsam x 3 donem x 3 sira)'
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
     case when v_read = 18 and not v_wrote
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
-- SENARYO 7 — 'season' dönemi penceresi, 'year' reddi
-- ---------------------------------------------------------------------------

do $$
declare
  v_season_start timestamptz;
  v_active_start timestamptz;
  v_season_rows integer;
  v_year_rejected boolean := false;
begin
  v_season_start := public.period_start('season');
  select s.starts_at into v_active_start from public.active_season() s;

  select count(*) into v_season_rows
  from public.leaderboard_reward_settings where period = 'season';

  /*
    'year' artik beyaz listede degil: leaderboard_top raise etmeli.
    Sessizce '-infinity'ye dusmesi, "Bu Yil" sekmesinin bombos
    gorunmesiyle ayni siniftan bir hataydi (D32'de olculdu).
  */
  begin
    perform * from public.leaderboard_top('turkiye', 'year', 10);
  exception when others then
    v_year_rejected := true;
  end;

  insert into t_result values
    ('7-sezon-donem', 'period_start(season)', coalesce(v_season_start::text, 'NULL')),
    ('7-sezon-donem', 'aktif sezon starts_at', coalesce(v_active_start::text, 'NULL')),
    ('7-sezon-donem', 'sezon ayar satiri', v_season_rows::text),
    ('7-sezon-donem', 'year reddedildi', v_year_rejected::text);

  insert into t_result values
    ('7-sezon-donem',
     case when v_season_start = v_active_start and v_season_rows = 6 and v_year_rejected
          then 'GECTI: pencere aktif sezondan, 6 sezon ayari, year reddedildi'
          else 'HATA: baslangic ' || coalesce(v_season_start::text, 'NULL')
               || ' vs ' || coalesce(v_active_start::text, 'NULL')
               || ', ayar ' || v_season_rows || ', year reddi ' || v_year_rejected end, '');
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 8 — sezon penceresi sınırı
-- ---------------------------------------------------------------------------

/*
  Iki islem: biri sezon baslangicindan BIR SANIYE once, biri bir saniye
  sonra. Sezon donemi yalnizca ikincisini saymali.

  Sinir kontrolu tek satirla yapilamaz: pencere disindaki satir hic
  yazilmazsa "toplam dogru" iddiasi yanlis sebeple de gecebilirdi. Iki
  satir birlikte hem dahil etmeyi hem dislamayi kanitliyor.
*/
do $$
declare
  v_u uuid := gen_random_uuid();
  v_start timestamptz;
  v_season_xp integer;
  v_all_xp integer;
begin
  select s.starts_at into v_start from public.active_season() s;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'lbsezon@example.com', '', now(), now(), now());
  insert into public.profiles (id, username) values (v_u, 'lbsezon')
  on conflict (id) do update set username = excluded.username;

  insert into public.xp_transactions (user_id, amount, reason, created_at)
  values (v_u, 4000, 'task', v_start - interval '1 second'),
         (v_u, 7, 'task', v_start + interval '1 second');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_u::text, 'role', 'authenticated')::text, true);

  select r.total_xp into v_season_xp
  from public.leaderboard_top('turkiye', 'season', 200) r where r.user_id = v_u;

  select r.total_xp into v_all_xp
  from public.leaderboard_top('turkiye', 'all', 200) r where r.user_id = v_u;

  perform set_config('role', 'postgres', true);

  insert into t_result values
    ('8-sinir', 'sezon XP / tum zamanlar XP',
     coalesce(v_season_xp::text, 'NULL') || ' / ' || coalesce(v_all_xp::text, 'NULL'));

  insert into t_result values
    ('8-sinir',
     case when v_season_xp = 7 and v_all_xp = 4007
          then 'GECTI: pencere disindaki 4000 XP sezona girmedi'
          else 'HATA: sezon ' || coalesce(v_season_xp::text, 'NULL')
               || ' (7 beklendi), tum ' || coalesce(v_all_xp::text, 'NULL')
               || ' (4007 beklendi)' end, '');
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 9 — sezon dağıtımı + settle_season_badges tek kapı
-- ---------------------------------------------------------------------------

do $$
declare
  v_season_id smallint;
  v_key text;
  v_first integer;
  v_second integer;
  v_awards integer;
  v_after_settle integer;
  v_flag boolean;
begin
  select s.id into v_season_id from public.seasons s
  where s.starts_at <= now() and s.ends_at > now() limit 1;

  v_key := 'sezon-' || v_season_id;

  v_first := public.award_leaderboard_rewards('turkiye', 'season', v_key);
  v_second := public.award_leaderboard_rewards('turkiye', 'season', v_key);

  select count(*) into v_awards from public.leaderboard_reward_awards
  where scope = 'turkiye' and period = 'season' and period_key = v_key;

  /*
    Sezonu bitmis gosterip settle_season_badges cagiriyoruz: ayni donem
    UCUNCU kez dagitilmaya calisiliyor. Kapi tablosu tutmali.
  */
  update public.seasons set ends_at = now() - interval '1 minute'
  where id = v_season_id;

  perform public.settle_season_badges();

  select count(*) into v_after_settle from public.leaderboard_reward_awards
  where scope = 'turkiye' and period = 'season' and period_key = v_key;

  select badge_awarded into v_flag from public.seasons where id = v_season_id;

  insert into t_result values
    ('9-sezon-dagitim', 'donem anahtari', v_key),
    ('9-sezon-dagitim', '1. cagri / 2. cagri', v_first || ' / ' || v_second),
    ('9-sezon-dagitim', 'kayit: award x2 / +settle', v_awards || ' / ' || v_after_settle),
    ('9-sezon-dagitim', 'badge_awarded', v_flag::text);

  insert into t_result values
    ('9-sezon-dagitim',
     case when v_first > 0 and v_second = 0 and v_awards = v_first
               and v_after_settle = v_awards and v_flag
          then 'GECTI: uc tetikleme, ' || v_awards || ' kayit; rozet bayragi kalkti'
          else 'HATA: 1.=' || v_first || ' 2.=' || v_second
               || ' kayit=' || v_awards || ' settle sonrasi=' || v_after_settle
               || ' bayrak=' || v_flag end, '');
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
