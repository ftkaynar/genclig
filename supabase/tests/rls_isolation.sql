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

\echo '=========================================================='
\echo 'SENARYO 0: onceki kosumdan kalan test verisini temizle'
\echo '(testin tekrarlanabilir olmasi icin; temiz db de no-op)'
\echo '=========================================================='

delete from auth.users where id in (:'A', :'B');
delete from public.provinces where id > 81;
select count(*) as kalan_test_kullanicisi from auth.users where id in (:'A', :'B');
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
   'b@test.local', 'x', now(), now(), now());

select count(*) as auth_users_sayisi from auth.users where id in (:'A', :'B');
select count(*) as trigger_ile_acilan_profil from public.profiles where id in (:'A', :'B');
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
\echo 'SON DURUM: provinces sayisi degismemis olmali (81)'
\echo '=========================================================='
select count(*) as provinces_toplam from public.provinces;
select count(*) as profiles_toplam from public.profiles;
