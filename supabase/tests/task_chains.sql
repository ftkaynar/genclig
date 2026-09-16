-- M32b testi: Görev Zincirleri ve idempotens.
--
-- Senaryolar:
--   1. Eksik adım varken bonus YOK
--   2. Son adım onaylanınca bonus yazılıyor (xp + token)
--   3. İKİ tetik tek kayıt (kapı tablosu) — idempotens
--   4. Bildirim 'chain_completed' düşüyor, bir kez
--   5. Adımlar sırasız tamamlanabiliyor
--   6. Pasif zincir bonus vermiyor
--   7. my_chains ilerlemeyi doğru sayıyor
--   8. Başka kullanıcının kapı satırı okunamıyor (RLS)
--
-- Çalıştırma:
--   docker exec -i supabase_db_genclig psql -U postgres -d postgres \
--     < supabase/tests/task_chains.sql

\set ON_ERROR_STOP off
\timing off

begin;

create temporary table t_result (senaryo text, sonuc text) on commit drop;
create temporary table t_ids (k text primary key, v uuid) on commit drop;

-- ---------------------------------------------------------------------------
-- Hazırlık: iki kullanıcı + üç adımlı zincir + pasif zincir
-- ---------------------------------------------------------------------------

do $$
declare
  v_u uuid := gen_random_uuid();
  v_o uuid := gen_random_uuid();
  v_cat smallint;
  v_t1 uuid; v_t2 uuid; v_t3 uuid; v_tp uuid;
  v_chain uuid; v_passive uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values
    (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'chain-a@example.com', '', now(), now(), now()),
    (v_o, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'chain-b@example.com', '', now(), now(), now());

  insert into public.profiles (id, username)
  values (v_u, 'chaina'), (v_o, 'chainb')
  on conflict (id) do update set username = excluded.username;

  select id into v_cat from public.task_categories order by id limit 1;

  insert into public.tasks (title, description, type, category_id, verification,
                            difficulty, scope, xp, coin, status, municipality_id)
  values ('Zincir 1', 't', 'continuous', v_cat, 'manual', 'easy',
          'individual', 10, 10, 'active', null) returning id into v_t1;
  insert into public.tasks (title, description, type, category_id, verification,
                            difficulty, scope, xp, coin, status, municipality_id)
  values ('Zincir 2', 't', 'continuous', v_cat, 'manual', 'easy',
          'individual', 10, 10, 'active', null) returning id into v_t2;
  insert into public.tasks (title, description, type, category_id, verification,
                            difficulty, scope, xp, coin, status, municipality_id)
  values ('Zincir 3', 't', 'continuous', v_cat, 'manual', 'easy',
          'individual', 10, 10, 'active', null) returning id into v_t3;
  insert into public.tasks (title, description, type, category_id, verification,
                            difficulty, scope, xp, coin, status, municipality_id)
  values ('Pasif adim', 't', 'continuous', v_cat, 'manual', 'easy',
          'individual', 10, 10, 'active', null) returning id into v_tp;

  insert into public.task_chains
    (title, description, icon, bonus_xp, bonus_token, status, sort)
  values ('Test Zinciri', 't', 'palette', 150, 100, 'active', 90)
  returning id into v_chain;

  insert into public.chain_steps (chain_id, task_id, sort)
  values (v_chain, v_t1, 0), (v_chain, v_t2, 1), (v_chain, v_t3, 2);

  insert into public.task_chains
    (title, description, icon, bonus_xp, bonus_token, status, sort)
  values ('Pasif Zincir', 't', 'palette', 999, 999, 'passive', 91)
  returning id into v_passive;

  insert into public.chain_steps (chain_id, task_id, sort)
  values (v_passive, v_tp, 0);

  insert into t_ids values ('u', v_u), ('o', v_o), ('t1', v_t1),
                           ('t2', v_t2), ('t3', v_t3), ('tp', v_tp),
                           ('chain', v_chain), ('passive', v_passive);
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 1, 5 — eksik adım varken bonus yok; sıra serbest
-- ---------------------------------------------------------------------------

do $$
declare
  v_u uuid := (select v from t_ids where k = 'u');
  v_chain uuid := (select v from t_ids where k = 'chain');
  v_s uuid;
  v_bonus integer;
begin
  -- Adımları TERS sırayla yap: 3, sonra 1.
  insert into public.task_submissions (task_id, user_id, status, period_key)
  values ((select v from t_ids where k = 't3'), v_u, 'approved', 'once')
  returning id into v_s;
  perform public.award_task_points(v_s);

  insert into public.task_submissions (task_id, user_id, status, period_key)
  values ((select v from t_ids where k = 't1'), v_u, 'approved', 'once')
  returning id into v_s;
  perform public.award_task_points(v_s);

  select count(*) into v_bonus
  from public.xp_transactions
  where user_id = v_u and reason = 'chain_bonus';

  insert into t_result values (
    '1-eksik adimda bonus yok',
    case when v_bonus = 0 then 'GECTI' else 'HATA: ' || v_bonus || ' bonus' end
  );

  insert into t_result values (
    '5-adimlar sirasiz yapilabiliyor',
    case when exists (
      select 1 from public.task_submissions
      where user_id = v_u and status = 'approved'
    ) then 'GECTI' else 'HATA: teslim yok' end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 7 — my_chains ilerlemesi (2/3)
-- ---------------------------------------------------------------------------

do $$
declare
  v_u uuid := (select v from t_ids where k = 'u');
  v_chain uuid := (select v from t_ids where k = 'chain');
  v_done integer;
  v_steps integer;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_u::text, 'role', 'authenticated')::text, true);

  select step_count, done_count into v_steps, v_done
  from public.my_chains() where chain_id = v_chain;

  perform set_config('role', 'postgres', true);

  insert into t_result values (
    '7-my_chains ilerleme 2/3',
    case when v_steps = 3 and v_done = 2 then 'GECTI'
         else 'HATA: ' || coalesce(v_done, -1) || '/' || coalesce(v_steps, -1) end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 2, 3, 4 — tamamlama, idempotens, bildirim
-- ---------------------------------------------------------------------------

do $$
declare
  v_u uuid := (select v from t_ids where k = 'u');
  v_chain uuid := (select v from t_ids where k = 'chain');
  v_s uuid;
  v_xp integer;
  v_token integer;
  v_xp_satir integer;
  v_kapi integer;
  v_bildirim integer;
begin
  insert into public.task_submissions (task_id, user_id, status, period_key)
  values ((select v from t_ids where k = 't2'), v_u, 'approved', 'once')
  returning id into v_s;

  perform public.award_task_points(v_s);

  select coalesce(sum(amount), 0) into v_xp
  from public.xp_transactions where user_id = v_u and reason = 'chain_bonus';
  select coalesce(sum(amount), 0) into v_token
  from public.coin_transactions where user_id = v_u and reason = 'chain_bonus';

  insert into t_result values (
    '2-son adimda bonus yazildi',
    case when v_xp = 150 and v_token = 100 then 'GECTI'
         else 'HATA: xp=' || v_xp || ' token=' || v_token
              || ' (150/100 olmali)' end
  );

  /*
    ---- 3: İKİ TETİK, TEK KAYIT.

    Aynı teslimi tekrar ödüllendirmek ve zinciri doğrudan yeniden
    kontrol etmek — ikisi de bonusu tekrar yazmamalı. Kapı tablosunun
    birincil anahtarı tek savunma hattı.
  */
  perform public.award_task_points(v_s);
  perform public.check_chain_completion(v_u, (select v from t_ids where k = 't1'));
  perform public.check_chain_completion(v_u, (select v from t_ids where k = 't3'));

  select count(*) into v_xp_satir
  from public.xp_transactions where user_id = v_u and reason = 'chain_bonus';

  select coalesce(sum(amount), 0) into v_xp
  from public.xp_transactions where user_id = v_u and reason = 'chain_bonus';

  select count(*) into v_kapi
  from public.chain_awards where user_id = v_u and chain_id = v_chain;

  insert into t_result values (
    '3-idempotens: dort tetik tek kayit',
    case when v_xp_satir = 1 and v_xp = 150 and v_kapi = 1 then 'GECTI'
         else 'HATA: satir=' || v_xp_satir || ' xp=' || v_xp
              || ' kapi=' || v_kapi end
  );

  select count(*) into v_bildirim
  from public.notifications
  where user_id = v_u and type = 'chain_completed';

  insert into t_result values (
    '4-bildirim bir kez',
    case when v_bildirim = 1 then 'GECTI'
         else 'HATA: ' || v_bildirim || ' bildirim' end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 6 — pasif zincir bonus vermiyor
-- ---------------------------------------------------------------------------

do $$
declare
  v_o uuid := (select v from t_ids where k = 'o');
  v_tp uuid := (select v from t_ids where k = 'tp');
  v_passive uuid := (select v from t_ids where k = 'passive');
  v_s uuid;
  v_bonus integer;
begin
  insert into public.task_submissions (task_id, user_id, status, period_key)
  values (v_tp, v_o, 'approved', 'once') returning id into v_s;

  perform public.award_task_points(v_s);

  select count(*) into v_bonus
  from public.chain_awards where chain_id = v_passive;

  insert into t_result values (
    '6-pasif zincir bonus vermiyor',
    case when v_bonus = 0 then 'GECTI' else 'HATA: bonus verildi' end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 8 — başkasının kapı satırı okunamıyor
-- ---------------------------------------------------------------------------

do $$
declare
  v_u uuid := (select v from t_ids where k = 'u');
  v_o uuid := (select v from t_ids where k = 'o');
  v_goren integer;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_o::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*) into v_goren
  from public.chain_awards where user_id = v_u;

  perform set_config('role', 'postgres', true);

  insert into t_result values (
    '8-baskasinin kapi satiri gizli',
    case when v_goren = 0 then 'GECTI'
         else 'HATA: ' || v_goren || ' satir gorundu' end
  );
end;
$$;

select senaryo, sonuc from t_result order by senaryo;

select
  count(*) filter (where sonuc like 'HATA%') as hata,
  count(*) filter (where sonuc = 'GECTI') as gecti
from t_result;

rollback;
