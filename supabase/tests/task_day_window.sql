-- M31 testi: görev günü penceresi (Europe/Istanbul 06:00).
--
-- Senaryolar:
--   1. Sınır saatleri doğru pencereye düşüyor (00:30, 05:59, 06:00, 23:59)
--   2. Ay ve yıl devri doğru
--   3. Dünkü teslim BUGÜNÜN sayacına girmiyor
--   4. Gece 01:00'daki teslim hâlâ ÖNCEKİ günün sayacında
--   5. Reddedilen teslim sayılmıyor (M20 kuralı bozulmadı)
--   6. Günlük sınır dolunca submit_task reddediyor
--
-- Çalıştırma:
--   docker exec -i supabase_db_genclig psql -U postgres -d postgres \
--     < supabase/tests/task_day_window.sql

\set ON_ERROR_STOP off
\timing off

begin;

create temporary table t_result (senaryo text, sonuc text) on commit drop;
create temporary table t_ids (k text primary key, v uuid) on commit drop;

-- ---------------------------------------------------------------------------
-- SENARYO 1-2 — pencere sınırları
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  v_got text;
begin
  for r in
    select * from (values
      ('gece 00:30',  timestamptz '2026-09-16 00:30+03', '2026-09-15 06:00'),
      ('sabah 05:59', timestamptz '2026-09-16 05:59+03', '2026-09-15 06:00'),
      ('sabah 06:00', timestamptz '2026-09-16 06:00+03', '2026-09-16 06:00'),
      ('gece 23:59',  timestamptz '2026-09-16 23:59+03', '2026-09-16 06:00'),
      ('ay devri',    timestamptz '2026-10-01 01:00+03', '2026-09-30 06:00'),
      ('yil devri',   timestamptz '2027-01-01 02:00+03', '2026-12-31 06:00')
    ) as v(label, at, beklenen)
  loop
    v_got := to_char(
      public.task_day_start(r.at) at time zone 'Europe/Istanbul',
      'YYYY-MM-DD HH24:MI'
    );

    insert into t_result values (
      '1-pencere ' || r.label,
      case when v_got = r.beklenen then 'GECTI'
           else 'HATA: ' || v_got || ' (beklenen ' || r.beklenen || ')' end
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Hazırlık: bir kullanıcı + bir sürekli görev
-- ---------------------------------------------------------------------------

do $$
declare
  v_u uuid := gen_random_uuid();
  v_t uuid;
  v_cat smallint;
  v_mun uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'day-window@example.com', '', now(), now(), now());

  insert into public.profiles (id, username)
  values (v_u, 'daywindow')
  on conflict (id) do update set username = excluded.username;

  select id into v_cat from public.task_categories order by id limit 1;
  select id into v_mun from public.municipalities order by id limit 1;

  insert into public.tasks (
    title, description, type, category_id, verification, difficulty,
    scope, xp, coin, status, municipality_id, daily_submission_limit
  )
  values (
    'Gun penceresi testi', 'test', 'continuous', v_cat, 'manual', 'easy',
    'individual', 10, 10, 'active', v_mun, 2
  )
  returning id into v_t;

  insert into t_ids values ('u', v_u), ('t', v_t);
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 3-5 — sayaç penceresi
-- ---------------------------------------------------------------------------

do $$
declare
  v_u uuid := (select v from t_ids where k = 'u');
  v_t uuid := (select v from t_ids where k = 't');
  v_bugun timestamptz := public.task_day_start(now());
  v_sayac integer;
begin
  -- DÜNKÜ onaylı teslim (bir önceki pencerenin ortası).
  insert into public.task_submissions
    (task_id, user_id, status, period_key, created_at)
  values (v_t, v_u, 'approved', 'once', v_bugun - interval '10 hours');

  v_sayac := public.daily_submission_count(v_t, v_u);

  insert into t_result values (
    '3-dunku teslim bugunun sayacinda degil',
    case when v_sayac = 0 then 'GECTI' else 'HATA: sayac=' || v_sayac end
  );

  /*
    Gece 01:00 teslimi: takvim günü "bugün" ama görev günü DÜNKÜ pencere.
    Eski kural (::date karşılaştırması) burada 1 sayıyordu — bu satır o
    hatanın nöbetçisi.
  */
  insert into public.task_submissions
    (task_id, user_id, status, period_key, created_at)
  values (v_t, v_u, 'approved', 'once', v_bugun - interval '5 hours');

  v_sayac := public.daily_submission_count(v_t, v_u);

  insert into t_result values (
    '4-gece 01:00 teslimi onceki gunde',
    case when v_sayac = 0 then 'GECTI' else 'HATA: sayac=' || v_sayac end
  );

  -- BUGÜNKÜ reddedilen teslim sayılmamalı.
  insert into public.task_submissions
    (task_id, user_id, status, period_key, created_at)
  values (v_t, v_u, 'rejected', 'once', v_bugun + interval '1 minute');

  v_sayac := public.daily_submission_count(v_t, v_u);

  insert into t_result values (
    '5-reddedilen sayilmiyor',
    case when v_sayac = 0 then 'GECTI' else 'HATA: sayac=' || v_sayac end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 6 — günlük sınır submit_task'ta uygulanıyor
-- ---------------------------------------------------------------------------

do $$
declare
  v_u uuid := (select v from t_ids where k = 'u');
  v_t uuid := (select v from t_ids where k = 't');
  v_bugun timestamptz := public.task_day_start(now());
  v_reddedildi boolean := false;
  v_mesaj text := '';
begin
  -- Günlük sınır 2. Bugünün penceresine iki teslim koy.
  insert into public.task_submissions
    (task_id, user_id, status, period_key, created_at)
  values
    (v_t, v_u, 'pending', 'once', v_bugun + interval '2 minutes'),
    (v_t, v_u, 'pending', 'once', v_bugun + interval '3 minutes');

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_u::text, 'role', 'authenticated')::text, true);

  /*
    Mesaj da sınanıyor: "herhangi bir hata" yeşil sayılsaydı, takıma
    katılmamış kullanıcı hatası da bu testi geçirirdi (D30'da tam bu
    sınıf bir yanlış-geçiş ölçülmüştü).
  */
  begin
    perform public.submit_task(v_t);
  exception when others then
    v_reddedildi := true;
    v_mesaj := sqlerrm;
  end;

  perform set_config('role', 'postgres', true);

  insert into t_result values (
    '6-gunluk sinir uygulaniyor',
    case when v_reddedildi and v_mesaj like '%bugün için yeterince%'
         then 'GECTI'
         when v_reddedildi then 'HATA: baska hata -> ' || v_mesaj
         else 'HATA: 3. teslim gecti' end
  );
end;
$$;

select senaryo, sonuc from t_result order by senaryo;

select
  count(*) filter (where sonuc like 'HATA%') as hata,
  count(*) filter (where sonuc = 'GECTI') as gecti
from t_result;

rollback;
