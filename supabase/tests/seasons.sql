-- M32d testi: Sezonlar ve sezon rozeti.
--
-- Senaryolar:
--   1. active_season tarihe göre çözülüyor (status etiketine değil)
--   2. Sezon bitişi: KATILANA rozet
--   3. Katılmayana rozet YOK
--   4. İdempotens: üç koşu tek rozet, tek bildirim
--   5. badge_awarded bayrağı işaretleniyor, status 'ended' oluyor
--   6. Rozet criteria tipi 'season' — normal rozet döngüsü dağıtmıyor
--   7. Sezon aralığı DIŞINDAKİ teslim sayılmıyor
--
-- Çalıştırma:
--   docker exec -i supabase_db_genclig psql -U postgres -d postgres \
--     < supabase/tests/seasons.sql

\set ON_ERROR_STOP off
\timing off

begin;

create temporary table t_result (senaryo text, sonuc text) on commit drop;
create temporary table t_ids (k text primary key, v uuid) on commit drop;
create temporary table t_num (k text primary key, v integer) on commit drop;

-- ---------------------------------------------------------------------------
-- Hazırlık: üç kullanıcı + bitmiş bir sezon + bir görev
-- ---------------------------------------------------------------------------

do $$
declare
  v_in uuid := gen_random_uuid();     -- sezonda görev yapan
  v_out uuid := gen_random_uuid();    -- hiç görev yapmayan
  v_late uuid := gen_random_uuid();   -- sezon DIŞINDA görev yapan
  v_cat smallint;
  v_task uuid;
  v_season smallint;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values
    (v_in,   '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'sez-in@example.com', '', now(), now(), now()),
    (v_out,  '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'sez-out@example.com', '', now(), now(), now()),
    (v_late, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'sez-late@example.com', '', now(), now(), now());

  insert into public.profiles (id, username)
  values (v_in, 'sezin'), (v_out, 'sezout'), (v_late, 'sezlate')
  on conflict (id) do update set username = excluded.username;

  select id into v_cat from public.task_categories order by id limit 1;

  insert into public.tasks (title, description, type, category_id, verification,
                            difficulty, scope, xp, coin, status, municipality_id)
  values ('Sezon gorevi', 't', 'continuous', v_cat, 'manual', 'easy',
          'individual', 10, 10, 'active', null)
  returning id into v_task;

  /*
    BİTMİŞ sezon: geçen ay başladı, dün bitti. Gerçek Sezon 1'e
    dokunulmuyor — test kendi sezonunu kuruyor.
  */
  insert into public.seasons (name, starts_at, ends_at, theme, status)
  values ('Test Sezonu', now() - interval '30 days', now() - interval '1 day',
          'gold', 'active')
  returning id into v_season;

  -- Sezon İÇİNDE teslim
  insert into public.task_submissions
    (task_id, user_id, status, period_key, created_at)
  values (v_task, v_in, 'approved', 'once', now() - interval '10 days');

  -- Sezon DIŞINDA teslim (bitişten sonra)
  insert into public.task_submissions
    (task_id, user_id, status, period_key, created_at)
  values (v_task, v_late, 'approved', 'once', now() - interval '2 hours');

  insert into t_ids values ('in', v_in), ('out', v_out), ('late', v_late),
                           ('task', v_task);
  insert into t_num values ('season', v_season);
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 1 — aktif sezon tarihe göre
-- ---------------------------------------------------------------------------

do $$
declare
  v_ad text;
  v_bitmis smallint := (select v from t_num where k = 'season');
  v_sayim integer;
begin
  select name into v_ad from public.active_season();

  -- Bitmiş sezon 'active' etiketli olmasına RAĞMEN aktif sayılmamalı.
  select count(*) into v_sayim
  from public.active_season() a
  where a.id = v_bitmis;

  insert into t_result values (
    '1-aktif sezon tarihe gore',
    case when v_sayim = 0 and v_ad is not null then 'GECTI'
         else 'HATA: bitmis sezon aktif sayildi (' || coalesce(v_ad, 'null') || ')' end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 2, 3, 4, 5, 7 — sezon sonu dağıtımı
-- ---------------------------------------------------------------------------

do $$
declare
  v_in uuid := (select v from t_ids where k = 'in');
  v_out uuid := (select v from t_ids where k = 'out');
  v_late uuid := (select v from t_ids where k = 'late');
  v_season smallint := (select v from t_num where k = 'season');
  v_slug text := 'sezon-' || (select v from t_num where k = 'season');
  v_badge uuid;
  v_verilen integer;
  v_in_rozet integer; v_out_rozet integer; v_late_rozet integer;
  v_bildirim integer;
  v_bayrak boolean; v_durum text;
begin
  v_verilen := public.settle_season_badges();

  select id into v_badge from public.badges where slug = v_slug;

  select count(*) into v_in_rozet from public.user_badges
  where user_id = v_in and badge_id = v_badge;
  select count(*) into v_out_rozet from public.user_badges
  where user_id = v_out and badge_id = v_badge;
  select count(*) into v_late_rozet from public.user_badges
  where user_id = v_late and badge_id = v_badge;

  insert into t_result values (
    '2-katilana rozet',
    case when v_in_rozet = 1 then 'GECTI'
         else 'HATA: rozet=' || v_in_rozet end
  );

  insert into t_result values (
    '3-katilmayana rozet yok',
    case when v_out_rozet = 0 then 'GECTI'
         else 'HATA: rozet verildi' end
  );

  insert into t_result values (
    '7-sezon disi teslim sayilmiyor',
    case when v_late_rozet = 0 then 'GECTI'
         else 'HATA: rozet verildi' end
  );

  select badge_awarded, status into v_bayrak, v_durum
  from public.seasons where id = v_season;

  insert into t_result values (
    '5-bayrak ve durum guncellendi',
    case when v_bayrak and v_durum = 'ended' then 'GECTI'
         else 'HATA: bayrak=' || v_bayrak || ' durum=' || v_durum end
  );

  /*
    ---- 4: ÜÇ KOŞU, TEK ROZET.

    İkinci koşu badge_awarded bayrağına takılıyor. Üçüncüde bayrak elle
    sıfırlanıyor: user_badges birincil anahtarının tek başına da
    yeterli olduğu gösteriliyor — iki savunma hattı da sınanmalı.
  */
  perform public.settle_season_badges();

  update public.seasons set badge_awarded = false where id = v_season;
  perform public.settle_season_badges();

  select count(*) into v_in_rozet from public.user_badges
  where user_id = v_in and badge_id = v_badge;

  select count(*) into v_bildirim from public.notifications
  where user_id = v_in and type = 'badge_earned' and ref_id = v_badge;

  insert into t_result values (
    '4-idempotens: uc kosu tek rozet',
    case when v_in_rozet = 1 and v_bildirim = 1 then 'GECTI'
         else 'HATA: rozet=' || v_in_rozet || ' bildirim=' || v_bildirim end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 6 — normal rozet döngüsü sezon rozetini dağıtmıyor
-- ---------------------------------------------------------------------------

do $$
declare
  v_out uuid := (select v from t_ids where k = 'out');
  v_slug text := 'sezon-' || (select v from t_num where k = 'season');
  v_badge uuid;
  v_rozet integer;
  v_tip text;
begin
  select id, criteria ->> 'type' into v_badge, v_tip
  from public.badges where slug = v_slug;

  -- Hiç görev yapmamış kullanıcıda bile rozet döngüsünü çalıştır.
  perform public.check_and_award_badges(v_out);

  select count(*) into v_rozet from public.user_badges
  where user_id = v_out and badge_id = v_badge;

  insert into t_result values (
    '6-normal dongu sezon rozetini vermiyor',
    case when v_rozet = 0 and v_tip = 'season' then 'GECTI'
         else 'HATA: rozet=' || v_rozet || ' tip=' || coalesce(v_tip, 'null') end
  );
end;
$$;

select senaryo, sonuc from t_result order by senaryo;

select
  count(*) filter (where sonuc like 'HATA%') as hata,
  count(*) filter (where sonuc = 'GECTI') as gecti
from t_result;

rollback;
