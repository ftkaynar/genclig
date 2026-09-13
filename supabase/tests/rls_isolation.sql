-- ############################################################################
-- SADECE YEREL DB'DE KOŞ. Bu betiği bulut veritabanında ÇALIŞTIRMA.
--
-- Dosya auth.users tablosuna doğrudan sahte kullanıcı yazar, bir kullanıcıya
-- super_admin rolü verir ve provinces tablosuna test kaydı ekler. Bulutta
-- koşarsa gerçek kullanıcı verisini ve yetkilendirmeyi bozar.
--
-- Koşma biçimi (yerel yığın ayakta olmalı):
--   pnpm db:reset
--   docker exec -i supabase_db_genclig psql -X -v ON_ERROR_STOP=0 \
--     -U postgres -d postgres < supabase/tests/rls_isolation.sql
--
-- Betik tekrarlanabilir: SENARYO 0 önceki koşumdan kalan test verisini siler,
-- bu yüzden db:reset olmadan da art arda koşulabilir.
--
-- Beklenen sonuçlar dosya içindeki \echo satırlarında yazılı.
-- ############################################################################

\pset pager off
\set A '00000000-0000-0000-0000-00000000000a'
\set B '00000000-0000-0000-0000-00000000000b'
-- C: hiçbir rolü olmayan üçüncü kullanıcı. Görev senaryolarında gerekli,
-- çünkü A senaryo 6'da kalıcı olarak super_admin oluyor ve süper adminin
-- görünürlüğü normal kullanıcıyı temsil etmiyor.
\set C '00000000-0000-0000-0000-00000000000c'

\echo '=========================================================='
\echo 'SENARYO 0: onceki kosumdan kalan test verisini temizle'
\echo '(testin tekrarlanabilir olmasi icin; temiz db de no-op)'
\echo '=========================================================='

delete from auth.users where id in (:'A', :'B', :'C');
delete from public.provinces where id > 81;
select count(*) as kalan_test_kullanicisi from auth.users where id in (:'A', :'B', :'C');
select count(*) as kalan_test_rolu from public.user_roles where user_id in (:'A', :'B');

\echo ''
\echo '=========================================================='
\echo 'SENARYO 1: iki test kullanicisi + trigger profil aciyor mu'
\echo '=========================================================='

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  (:'A', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'a@test.local', 'x', now(), now(), now()),
  (:'B', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'b@test.local', 'x', now(), now(), now()),
  (:'C', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'c@test.local', 'x', now(), now(), now());

select count(*) as auth_users_sayisi from auth.users where id in (:'A', :'B', :'C');
select count(*) as trigger_ile_acilan_profil from public.profiles where id in (:'A', :'B', :'C');
select id, created_at is not null as created_at_dolu from public.profiles order by id;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 2: A kendi profilini gorur, B ninkini gormez'
\echo '=========================================================='

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select current_user as aktif_rol, auth.uid() as auth_uid;
select count(*) as a_toplam_gorunen_profil from public.profiles;
select count(*) as a_kendi_profili from public.profiles where id = :'A';
select count(*) as a_nin_gordugu_b_profili from public.profiles where id = :'B';
rollback;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 3: A, B nin profilini UPDATE deniyor -> 0 satir'
\echo '=========================================================='

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
update public.profiles set display_name = 'ELE GECIRILDI' where id = :'B';
\echo '(yukaridaki UPDATE satir sayisina bakin: 0 olmali)'
update public.profiles set display_name = 'kendi adim' where id = :'A';
\echo '(yukaridaki UPDATE 1 olmali: kendi satiri)'
rollback;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 4: anon rolu -> provinces 81 satir, profiles 0 satir'
\echo '=========================================================='

begin;
select set_config('request.jwt.claims', '', true);
set local role anon;
select current_user as aktif_rol;
select count(*) as anon_provinces from public.provinces;
select count(*) as anon_profiles from public.profiles;
rollback;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 5: authenticated A -> provinces INSERT reddedilmeli'
\echo '=========================================================='

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select public.is_super_admin() as rol_oncesi_is_super_admin;
insert into public.provinces (id, name) values (82, 'SAHTE IL');
\echo '(yukarida RLS hatasi bekleniyor)'
rollback;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 6: A ya super_admin verilince INSERT calismali'
\echo '=========================================================='

insert into public.user_roles (user_id, role, municipality_id) values (:'A', 'super_admin', null);
select count(*) as a_super_admin_satiri from public.user_roles where user_id = :'A' and role = 'super_admin';

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select public.is_super_admin() as rol_sonrasi_is_super_admin;
insert into public.provinces (id, name) values (82, 'TEST ILI');
\echo '(yukarida INSERT 1 olmali)'
select count(*) as provinces_sayisi_insert_sonrasi from public.provinces;
rollback;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 6b: B hala super_admin degil -> INSERT reddedilmeli'
\echo '=========================================================='

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select public.is_super_admin() as b_is_super_admin;
insert into public.provinces (id, name) values (83, 'SAHTE IL 2');
\echo '(yukarida RLS hatasi bekleniyor)'
rollback;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 7: A kendi rolunu gorur, B ninkini gormez'
\echo '=========================================================='

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select count(*) as b_nin_gordugu_rol_satiri from public.user_roles;
rollback;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 8: gorev gorunurlugu (aktif herkese, draft degil)'
\echo '=========================================================='

\set T1 '0000f1a5-0000-4000-8000-000000000001'

select count(*) as postgres_gozuyle_tum_gorevler from public.tasks;
select count(*) as postgres_gozuyle_draft from public.tasks where status = 'draft';

begin;
select set_config('request.jwt.claims', '', true);
set local role anon;
select count(*) as anon_gordugu_gorev from public.tasks;
select count(*) as anon_gordugu_draft from public.tasks where status = 'draft';
select count(*) as anon_gordugu_kategori from public.task_categories;
rollback;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select count(*) as c_gordugu_gorev from public.tasks;
select count(*) as c_gordugu_draft from public.tasks where status = 'draft';
rollback;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select public.is_super_admin() as a_super_admin_mi;
select count(*) as a_gordugu_gorev_super_admin from public.tasks;
rollback;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 9: teslim acma ve donemde tek teslim kurali'
\echo '=========================================================='

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
-- Client bilerek yanlis bir period_key gonderiyor; trigger bunu ezmeli.
insert into public.task_submissions (task_id, user_id, period_key, note)
values (:'T1', :'C', 'HILE-ANAHTARI', 'ilk teslim');
\echo '(yukaridaki INSERT 1 olmali)'
commit;

select task_id, user_id, period_key, status, note
from public.task_submissions where user_id = :'C';
\echo '(period_key HILE-ANAHTARI degil, once olmali: trigger ezdi)'

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
insert into public.task_submissions (task_id, user_id, note)
values (:'T1', :'C', 'ayni donemde ikinci teslim');
\echo '(yukarida unique ihlali bekleniyor)'
rollback;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 10: teslimde kimlik ve durum zorlamasi'
\echo '=========================================================='

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
insert into public.task_submissions (task_id, user_id, status)
values ('0000f1a5-0000-4000-8000-000000000002', :'C', 'approved');
\echo '(yukarida RLS hatasi bekleniyor: kendini onaylayamaz)'
rollback;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
insert into public.task_submissions (task_id, user_id)
values ('0000f1a5-0000-4000-8000-000000000002', :'B');
\echo '(yukarida RLS hatasi bekleniyor: baskasi adina teslim acamaz)'
rollback;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select count(*) as b_nin_gordugu_teslim from public.task_submissions;
rollback;
\echo '(B baska kullanicinin teslimini gormemeli: 0)'

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select count(*) as c_nin_gordugu_kendi_teslimi from public.task_submissions;
rollback;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select count(*) as super_adminin_gordugu_teslim from public.task_submissions;
rollback;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 11: task_period_key donem anahtarlari'
\echo '=========================================================='

select
  public.task_period_key('continuous', now()) as continuous,
  public.task_period_key('instant', now()) as instant,
  public.task_period_key('daily', now()) as daily,
  public.task_period_key('weekly', now()) as weekly,
  public.task_period_key('monthly', now()) as monthly;

select
  to_char(now() at time zone 'Europe/Istanbul', 'YYYY-MM-DD') as beklenen_daily,
  to_char(now() at time zone 'Europe/Istanbul', 'IYYY"W"IW') as beklenen_weekly,
  to_char(now() at time zone 'Europe/Istanbul', 'YYYY-MM') as beklenen_monthly;

\echo ''
\echo '=========================================================='
\echo 'SON DURUM: provinces sayisi degismemis olmali (81)'
\echo '=========================================================='
select count(*) as provinces_toplam from public.provinces;
select count(*) as profiles_toplam from public.profiles;
