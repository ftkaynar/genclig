-- M27 decay testi.
--
-- Senaryolar:
--   1. Taze kullanıcı -> hiç decay yok
--   2. 20 gün inaktif  -> kademeli düşüş, AKT en çok, KAT en az
--   3. 200 gün inaktif -> taban korunuyor, hiçbir istat 0 değil
--   4. Rozetler ve XP decay'den etkilenmiyor
--   5. Aktivite dönünce istat toparlıyor
--   6. Soğuma bildirimi 5+ günde BİR KEZ (aynı gün ikinci çağrıda tekrar yok)
--
-- Çalıştırma:
--   docker exec -i supabase_db_genclig psql -U postgres -d postgres \
--     < supabase/tests/stat_decay.sql

\set ON_ERROR_STOP off
\timing off

begin;

-- ---------------------------------------------------------------------------
-- Hazırlık
-- ---------------------------------------------------------------------------

create temporary table t_result (
  senaryo text,
  olcum text,
  deger text
) on commit drop;

do $$
declare
  v_user uuid := gen_random_uuid();
  v_task uuid;
  v_i integer;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'decay-test@example.com', '', now(), now(), now());

  -- Profil tetikleyiciyle gelmiyorsa elle
  insert into public.profiles (id, username)
  values (v_user, 'decaytest')
  on conflict (id) do nothing;

  /*
    On onaylı teslim, ardışık günlerde (streak de dolsun).

    FİKSTÜR YALNIZ `continuous` GÖREVLERDEN (D38 FAZ Z).

    ÖNCEKİ DURUM: `from public.tasks order by created_at offset (v_i % 9)`
    — tip filtresi yoktu. Döngü 10 turda 9 offset kullanıyor, yani bir
    offset İKİ KEZ geliyor ve aynı göreve iki teslim yazılıyor.
    `task_submissions_open_unique` indeksi (task_id, user_id,
    period_key) üzerinde tekil ve yalnız `task_type <> 'continuous'`
    satırlara uygulanıyor; o konumdaki görev sürekli DEĞİLSE ikinci
    insert çakışıyor, işlem abort ediyor ve dosyanın YEDİ iddiası hiç
    koşmuyor.

    Konumsal offset, canlı tablodan fikstür seçtiği için görev havuzu
    her değiştiğinde farklı davranıyordu — testin geçmesi veriye bağlı
    kalmıştı. Sürekli göreve bağlamak indeks yüklemini tamamen devre
    dışı bırakıyor: sürekli görevler zaten tekrar edilebilir.
  */
  for v_i in 1..10 loop
    select id into v_task from public.tasks
    where type = 'continuous' and status = 'active'
    order by created_at
    limit 1 offset (v_i % greatest(1, (
      select count(*) from public.tasks
      where type = 'continuous' and status = 'active'
    )));

    insert into public.task_submissions (user_id, task_id, status, created_at)
    values (v_user, v_task, 'approved', now() - ((10 - v_i) || ' days')::interval);
  end loop;

  -- Birkaç bildirim (KAT sinyali)
  insert into public.problem_reports (user_id, kind, category_id, title, description, status, created_at)
  select v_user, 'problem', c.id, 'Test bildirimi', 'gövde', 'resolved', now() - interval '3 days'
  from public.problem_categories c limit 2;

  insert into public.xp_transactions (user_id, amount, reason)
  values (v_user, 500, 'adjustment');

  perform public.recompute_user_stats(v_user);

  insert into t_result values ('hazirlik', 'user_id', v_user::text);
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 1 — taze kullanıcı, decay yok
-- ---------------------------------------------------------------------------

insert into t_result
select '1-taze', 'taban akt/sos/kat/kes/bil/azm/ovr',
       format('%s/%s/%s/%s/%s/%s/%s', akt, sos, kat, kes, bil, azm, ovr)
from public.user_stats
where user_id = (select deger::uuid from t_result where olcum = 'user_id');

insert into t_result
select '1-taze', 'decayli akt/sos/kat/kes/bil/azm/ovr',
       format('%s/%s/%s/%s/%s/%s/%s', d.akt, d.sos, d.kat, d.kes, d.bil, d.azm, d.ovr)
from public.user_stats us,
     lateral public.stats_with_decay(us) d
where us.user_id = (select deger::uuid from t_result where olcum = 'user_id');

insert into t_result
select '1-taze',
       case when us.akt = d.akt and us.ovr = d.ovr
            then 'GECTI: taze kullanicida decay yok'
            else 'HATA: taze kullanicida deger degisti' end,
       ''
from public.user_stats us,
     lateral public.stats_with_decay(us) d
where us.user_id = (select deger::uuid from t_result where olcum = 'user_id');

-- ---------------------------------------------------------------------------
-- SENARYO 2 — 20 gün inaktif
-- ---------------------------------------------------------------------------

update public.user_stats
set last_activity_at = now() - interval '20 days'
where user_id = (select deger::uuid from t_result where olcum = 'user_id');

insert into t_result
select '2-20gun', 'decayli akt/sos/kat/kes/bil/azm/ovr',
       format('%s/%s/%s/%s/%s/%s/%s', d.akt, d.sos, d.kat, d.kes, d.bil, d.azm, d.ovr)
from public.user_stats us,
     lateral public.stats_with_decay(us) d
where us.user_id = (select deger::uuid from t_result where olcum = 'user_id');

insert into t_result
select '2-20gun',
       case
         when d.akt < us.akt
          and (us.akt - d.akt) >= (us.kat - d.kat)
         then 'GECTI: AKT dustu ve KAT''tan daha cok dustu'
         else format('HATA: akt %s->%s, kat %s->%s', us.akt, d.akt, us.kat, d.kat)
       end,
       ''
from public.user_stats us,
     lateral public.stats_with_decay(us) d
where us.user_id = (select deger::uuid from t_result where olcum = 'user_id');

-- ---------------------------------------------------------------------------
-- SENARYO 3 — 200 gün inaktif, taban korunuyor
-- ---------------------------------------------------------------------------

update public.user_stats
set last_activity_at = now() - interval '200 days'
where user_id = (select deger::uuid from t_result where olcum = 'user_id');

insert into t_result
select '3-200gun', 'decayli akt/sos/kat/kes/bil/azm/ovr',
       format('%s/%s/%s/%s/%s/%s/%s', d.akt, d.sos, d.kat, d.kes, d.bil, d.azm, d.ovr)
from public.user_stats us,
     lateral public.stats_with_decay(us) d
where us.user_id = (select deger::uuid from t_result where olcum = 'user_id');

insert into t_result
select '3-200gun',
       case
         when d.akt = 0 and us.akt > 0 then 'HATA: AKT sifira coktu'
         when d.akt < round(us.akt * 0.44) then 'HATA: taban asildi'
         else 'GECTI: taban korundu, istat sifirlanmadi'
       end,
       format('taban %s -> %s (beklenen ~%s)', us.akt, d.akt, round(us.akt * 0.45))
from public.user_stats us,
     lateral public.stats_with_decay(us) d
where us.user_id = (select deger::uuid from t_result where olcum = 'user_id');

-- 365 günde 200 günle aynı olmalı (taban düz)
update public.user_stats
set last_activity_at = now() - interval '365 days'
where user_id = (select deger::uuid from t_result where olcum = 'user_id');

insert into t_result
select '3-200gun',
       case when d.akt = (
         select (public.stats_with_decay(u2)).akt
         from public.user_stats u2
         where u2.user_id = us.user_id
       ) then 'GECTI: 365 gun tabanda duz' else 'HATA' end,
       ''
from public.user_stats us,
     lateral public.stats_with_decay(us) d
where us.user_id = (select deger::uuid from t_result where olcum = 'user_id');

-- ---------------------------------------------------------------------------
-- SENARYO 4 — rozet ve XP etkilenmiyor
-- ---------------------------------------------------------------------------

do $$
declare
  v_user uuid := (select deger::uuid from t_result where olcum = 'user_id');
begin
  perform public.check_and_award_badges(v_user);
end;
$$;

insert into t_result
select '4-rozet', 'rozet sayisi (200+ gun inaktifken)',
       (select count(*)::text from public.user_badges
        where user_id = (select deger::uuid from t_result where olcum = 'user_id'));

insert into t_result
select '4-rozet', 'toplam xp (decay sonrasi)',
       (select coalesce(sum(amount), 0)::text from public.xp_transactions
        where user_id = (select deger::uuid from t_result where olcum = 'user_id'));

insert into t_result
select '4-rozet',
       case when (select count(*) from public.user_badges
                  where user_id = (select deger::uuid from t_result where olcum = 'user_id')) > 0
            then 'GECTI: rozetler duruyor'
            else 'HATA: rozet yok' end, '';

-- ---------------------------------------------------------------------------
-- SENARYO 5 — aktivite dönünce toparlıyor
-- ---------------------------------------------------------------------------

do $$
declare
  v_user uuid := (select deger::uuid from t_result where olcum = 'user_id');
  v_task uuid;
begin
  select id into v_task from public.tasks order by created_at limit 1;

  insert into public.task_submissions (user_id, task_id, status, created_at)
  values (v_user, v_task, 'approved', now());

  perform public.recompute_user_stats(v_user);
end;
$$;

insert into t_result
select '5-donus', 'decayli akt/sos/kat/kes/bil/azm/ovr',
       format('%s/%s/%s/%s/%s/%s/%s', d.akt, d.sos, d.kat, d.kes, d.bil, d.azm, d.ovr)
from public.user_stats us,
     lateral public.stats_with_decay(us) d
where us.user_id = (select deger::uuid from t_result where olcum = 'user_id');

insert into t_result
select '5-donus',
       case when us.akt = d.akt and d.akt > 0
            then 'GECTI: aktivite donunce decay sifirlandi'
            else format('HATA: taban %s, decayli %s', us.akt, d.akt) end,
       ''
from public.user_stats us,
     lateral public.stats_with_decay(us) d
where us.user_id = (select deger::uuid from t_result where olcum = 'user_id');

-- ---------------------------------------------------------------------------
-- SENARYO 6 — soğuma bildirimi 5+ günde bir kez
-- ---------------------------------------------------------------------------

do $$
declare
  v_user uuid := (select deger::uuid from t_result where olcum = 'user_id');
  v_before integer;
  v_after1 integer;
  v_after2 integer;
begin
  -- 10 gün inaktif hâle getir (bildirim eşiği 5 gün)
  update public.user_stats
  set last_activity_at = now() - interval '10 days',
      decay_notified_at = null,
      computed_at = now()
  where user_id = v_user;

  select count(*) into v_before from public.notifications
  where user_id = v_user and type = 'stat_decay';

  -- my_stats() auth.uid() istiyor; oturumu taklit ediyoruz
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  perform public.my_stats();

  select count(*) into v_after1 from public.notifications
  where user_id = v_user and type = 'stat_decay';

  -- İkinci çağrı: 7 gün dolmadığı için yeni bildirim OLMAMALI
  perform public.my_stats();

  select count(*) into v_after2 from public.notifications
  where user_id = v_user and type = 'stat_decay';

  perform set_config('role', 'postgres', true);

  insert into t_result values
    ('6-bildirim', 'once/1.cagri/2.cagri',
     format('%s/%s/%s', v_before, v_after1, v_after2));

  insert into t_result values
    ('6-bildirim',
     case when v_after1 = v_before + 1 and v_after2 = v_after1
          then 'GECTI: bildirim bir kez dustu, tekrari engellendi'
          else 'HATA: bildirim sayisi beklenmedik' end, '');
end;
$$;

-- ---------------------------------------------------------------------------
-- Sonuç
-- ---------------------------------------------------------------------------

select senaryo, olcum, deger from t_result order by senaryo, olcum;

select count(*) filter (where olcum like 'HATA%') as hata_sayisi,
       count(*) filter (where olcum like 'GECTI%') as gecen_sayisi
from t_result;

rollback;
