-- M32c testi: Davet sistemi ve idempotens.
--
-- Senaryolar:
--   1. Her profilin tekil davet kodu var (yeni profilde trigger)
--   2. Geçerli kod referred_by yazıyor
--   3. Kendi kodunu kullanmak REDDEDİLİYOR
--   4. referred_by bir kez yazılıyor; değiştirilemiyor
--   5. Geçersiz kod hata veriyor
--   6. İlk onaylı görevde İKİ TARAFA da ödül
--   7. İdempotens: üç tetik tek kayıt, tek ödül
--   8. Davet edilmemiş kullanıcıya ödül yok
--   9. Ayar pasifken ödül yazılmıyor
--  10. Ayar miktarı değişimi etkili
--  11. Başkasının kapı satırı okunamıyor (RLS)
--
-- Çalıştırma:
--   docker exec -i supabase_db_genclig psql -U postgres -d postgres \
--     < supabase/tests/referrals.sql

\set ON_ERROR_STOP off
\timing off

begin;

create temporary table t_result (senaryo text, sonuc text) on commit drop;
create temporary table t_ids (k text primary key, v uuid) on commit drop;
create temporary table t_txt (k text primary key, v text) on commit drop;

-- ---------------------------------------------------------------------------
-- Hazırlık: davet eden + iki davetli + bir bağımsız + bir görev
-- ---------------------------------------------------------------------------

do $$
declare
  v_inv uuid := gen_random_uuid();   -- davet eden
  v_a uuid := gen_random_uuid();     -- davetli A
  v_b uuid := gen_random_uuid();     -- davetli B (pasif ayar testi)
  v_solo uuid := gen_random_uuid();  -- davetsiz
  v_cat smallint;
  v_task uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values
    (v_inv,  '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'ref-inv@example.com', '', now(), now(), now()),
    (v_a,    '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'ref-a@example.com', '', now(), now(), now()),
    (v_b,    '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'ref-b@example.com', '', now(), now(), now()),
    (v_solo, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'ref-solo@example.com', '', now(), now(), now());

  insert into public.profiles (id, username)
  values (v_inv, 'refinv'), (v_a, 'refa'), (v_b, 'refb'), (v_solo, 'refsolo')
  on conflict (id) do update set username = excluded.username;

  select id into v_cat from public.task_categories order by id limit 1;

  insert into public.tasks (title, description, type, category_id, verification,
                            difficulty, scope, xp, coin, status, municipality_id)
  values ('Davet gorevi', 't', 'continuous', v_cat, 'manual', 'easy',
          'individual', 10, 10, 'active', null)
  returning id into v_task;

  insert into t_ids values ('inv', v_inv), ('a', v_a), ('b', v_b),
                           ('solo', v_solo), ('task', v_task);

  insert into t_txt
  select 'inv_code', invite_code from public.profiles where id = v_inv;
  insert into t_txt
  select 'a_code', invite_code from public.profiles where id = v_a;
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 1 — kod üretimi
-- ---------------------------------------------------------------------------

do $$
declare
  v_kodsuz integer;
  v_toplam integer;
  v_tekil integer;
  v_inv_code text := (select v from t_txt where k = 'inv_code');
begin
  select count(*) filter (where invite_code is null),
         count(*),
         count(distinct invite_code)
  into v_kodsuz, v_toplam, v_tekil
  from public.profiles;

  insert into t_result values (
    '1-her profilde tekil kod',
    case when v_kodsuz = 0 and v_tekil = v_toplam
              and v_inv_code ~ '^[A-Z0-9]{8}$'
         then 'GECTI'
         else 'HATA: kodsuz=' || v_kodsuz || ' tekil=' || v_tekil
              || '/' || v_toplam || ' ornek=' || coalesce(v_inv_code, 'null') end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 2, 3, 4, 5 — kod bağlama kuralları
-- ---------------------------------------------------------------------------

do $$
declare
  v_inv uuid := (select v from t_ids where k = 'inv');
  v_a uuid := (select v from t_ids where k = 'a');
  v_inv_code text := (select v from t_txt where k = 'inv_code');
  v_a_code text := (select v from t_txt where k = 'a_code');
  v_ref uuid;
  v_hata text;
begin
  -- ---- 3: kendi kodu
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a::text, 'role', 'authenticated')::text, true);

  v_hata := '';
  begin
    perform public.apply_invite_code(v_a_code);
  exception when others then
    v_hata := sqlerrm;
  end;

  insert into t_result values (
    '3-kendi kodu reddediliyor',
    case when v_hata like '%Kendi davet kodunu%' then 'GECTI'
         else 'HATA: ' || coalesce(nullif(v_hata, ''), 'hic hata yok') end
  );

  -- ---- 5: geçersiz kod
  v_hata := '';
  begin
    perform public.apply_invite_code('ZZZZZZZZ');
  exception when others then
    v_hata := sqlerrm;
  end;

  insert into t_result values (
    '5-gecersiz kod hata veriyor',
    case when v_hata like '%bulunamadı%' then 'GECTI'
         else 'HATA: ' || coalesce(nullif(v_hata, ''), 'hic hata yok') end
  );

  -- ---- 2: geçerli kod
  perform public.apply_invite_code(v_inv_code);

  select referred_by into v_ref from public.profiles where id = v_a;

  insert into t_result values (
    '2-gecerli kod referred_by yaziyor',
    case when v_ref = v_inv then 'GECTI'
         else 'HATA: ' || coalesce(v_ref::text, 'null') end
  );

  -- ---- 4: ikinci kez değiştirilemez
  v_hata := '';
  begin
    perform public.apply_invite_code(v_inv_code);
  exception when others then
    v_hata := sqlerrm;
  end;

  insert into t_result values (
    '4-referred_by degistirilemiyor',
    case when v_hata like '%zaten tanımlı%' then 'GECTI'
         else 'HATA: ' || coalesce(nullif(v_hata, ''), 'hic hata yok') end
  );

  perform set_config('role', 'postgres', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 6, 7 — ödül ve idempotens
-- ---------------------------------------------------------------------------

do $$
declare
  v_inv uuid := (select v from t_ids where k = 'inv');
  v_a uuid := (select v from t_ids where k = 'a');
  v_task uuid := (select v from t_ids where k = 'task');
  v_s uuid;
  v_inv_xp integer; v_inv_tok integer;
  v_a_xp integer;   v_a_tok integer;
  v_satir integer;  v_kapi integer;  v_bildirim integer;
begin
  insert into public.task_submissions (task_id, user_id, status, period_key)
  values (v_task, v_a, 'approved', 'once') returning id into v_s;

  perform public.award_task_points(v_s);

  select coalesce(sum(amount), 0) into v_inv_xp from public.xp_transactions
  where user_id = v_inv and reason = 'referral';
  select coalesce(sum(amount), 0) into v_inv_tok from public.coin_transactions
  where user_id = v_inv and reason = 'referral';
  select coalesce(sum(amount), 0) into v_a_xp from public.xp_transactions
  where user_id = v_a and reason = 'referral';
  select coalesce(sum(amount), 0) into v_a_tok from public.coin_transactions
  where user_id = v_a and reason = 'referral';

  insert into t_result values (
    '6-iki tarafa da odul',
    case when v_inv_xp = 100 and v_inv_tok = 100
              and v_a_xp = 50 and v_a_tok = 50
         then 'GECTI'
         else 'HATA: davet eden ' || v_inv_xp || '/' || v_inv_tok
              || ' davetli ' || v_a_xp || '/' || v_a_tok
              || ' (100/100 ve 50/50 olmali)' end
  );

  /*
    ---- 7: ÜÇ TETİK, TEK KAYIT.

    Aynı teslimi tekrar ödüllendirmek, ikinci bir görev onaylamak ve
    doğrudan kontrolü çağırmak — üçü de ödülü tekrar yazmamalı.
    referral_awards'ın birincil anahtarı tek savunma hattı.
  */
  perform public.award_task_points(v_s);
  perform public.check_referral_reward(v_a);

  insert into public.task_submissions (task_id, user_id, status, period_key)
  values (v_task, v_a, 'approved', 'once') returning id into v_s;
  perform public.award_task_points(v_s);

  select count(*) into v_satir from public.xp_transactions
  where user_id = v_inv and reason = 'referral';
  select coalesce(sum(amount), 0) into v_inv_xp from public.xp_transactions
  where user_id = v_inv and reason = 'referral';
  select count(*) into v_kapi from public.referral_awards
  where invited_user_id = v_a;
  select count(*) into v_bildirim from public.notifications
  where user_id = v_inv and type = 'referral_reward';

  insert into t_result values (
    '7-idempotens: uc tetik tek kayit',
    case when v_satir = 1 and v_inv_xp = 100 and v_kapi = 1 and v_bildirim = 1
         then 'GECTI'
         else 'HATA: satir=' || v_satir || ' xp=' || v_inv_xp
              || ' kapi=' || v_kapi || ' bildirim=' || v_bildirim end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 8 — davetsiz kullanıcıya ödül yok
-- ---------------------------------------------------------------------------

do $$
declare
  v_solo uuid := (select v from t_ids where k = 'solo');
  v_task uuid := (select v from t_ids where k = 'task');
  v_s uuid;
  v_odul integer;
begin
  insert into public.task_submissions (task_id, user_id, status, period_key)
  values (v_task, v_solo, 'approved', 'once') returning id into v_s;

  perform public.award_task_points(v_s);

  select count(*) into v_odul from public.referral_awards
  where invited_user_id = v_solo;

  insert into t_result values (
    '8-davetsiz kullaniciya odul yok',
    case when v_odul = 0 then 'GECTI' else 'HATA: odul verildi' end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 9, 10 — ayarlar
-- ---------------------------------------------------------------------------

do $$
declare
  v_inv uuid := (select v from t_ids where k = 'inv');
  v_b uuid := (select v from t_ids where k = 'b');
  v_task uuid := (select v from t_ids where k = 'task');
  v_inv_code text := (select v from t_txt where k = 'inv_code');
  v_s uuid;
  v_odul integer;
  v_xp integer;
begin
  -- B'yi davetli yap.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_b::text, 'role', 'authenticated')::text, true);
  perform public.apply_invite_code(v_inv_code);
  perform set_config('role', 'postgres', true);

  -- ---- 9: ayar pasif
  update public.referral_settings set active = false where id = 1;

  insert into public.task_submissions (task_id, user_id, status, period_key)
  values (v_task, v_b, 'approved', 'once') returning id into v_s;
  perform public.award_task_points(v_s);

  select count(*) into v_odul from public.referral_awards
  where invited_user_id = v_b;

  insert into t_result values (
    '9-pasif ayarda odul yok',
    case when v_odul = 0 then 'GECTI' else 'HATA: odul verildi' end
  );

  -- ---- 10: miktar değişimi etkili
  update public.referral_settings
  set active = true, inviter_xp = 777, invited_xp = 333 where id = 1;

  perform public.check_referral_reward(v_b);

  /*
    777 tutarında bir satır VAR MI diye bakılıyor, "son satır" diye
    değil: işlem içinde now() sabit, bu yüzden created_at iki satırı
    ayırt etmiyor ve sıralama rastgele sonuç veriyordu (ölçüldü: 100
    döndü, 777 bekleniyordu).
  */
  select count(*) into v_xp from public.xp_transactions
  where user_id = v_inv and reason = 'referral' and amount = 777;

  insert into t_result values (
    '10-ayar miktari etkili',
    case when v_xp = 1 then 'GECTI'
         else 'HATA: 777lik satir sayisi=' || coalesce(v_xp, -1) end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 11 — başkasının kapı satırı gizli
-- ---------------------------------------------------------------------------

do $$
declare
  v_a uuid := (select v from t_ids where k = 'a');
  v_solo uuid := (select v from t_ids where k = 'solo');
  v_goren integer;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_solo::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*) into v_goren from public.referral_awards
  where invited_user_id = v_a;

  perform set_config('role', 'postgres', true);

  insert into t_result values (
    '11-baskasinin kapi satiri gizli',
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
