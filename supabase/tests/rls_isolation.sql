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
-- Duyuru senaryosunun test belediyesi (SENARYO 25).
delete from public.municipalities where slug in ('rls-duyuru-bld', 'rls-inc-bld');
delete from public.tasks where title in ('RLS gunluk gorev', 'RLS belediye gorevi', 'Senaryo 9 gunluk gorev', 'RLS limit gorevi', 'RLS limit gunluk gorev');
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
\echo 'SENARYO 9: teslim acma, period_key ezme ve tekillik kurali'
\echo '=========================================================='

/*
  D24 R2 NOTU — bu senaryo guncellendi.

  Eskiden ikinci teslim T1 (SUREKLI gorev) uzerinde denenip "unique ihlali
  bekleniyor" deniyordu. R2 ile surekli gorevlerde acik teslim tekilligi
  BILEREK kaldirildi; sonuc olarak o iddia sessizce gecmeye basladi ve
  test yalan soyluyordu (olculdu: toplam ERROR 24 yerine 23 cikti).

  Yerine iki ayri iddia kondu:
    - surekli gorevde ikinci teslim ACILABILIR,
    - donemsel (daily) gorevde ayni donemde ikinci teslim ENGELLI.
*/

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
-- Client bilerek yanlis bir period_key gonderiyor; trigger bunu ezmeli.
insert into public.task_submissions (task_id, user_id, period_key, note)
values (:'T1', :'C', 'HILE-ANAHTARI', 'ilk teslim');
\echo '(yukaridaki INSERT 1 olmali)'
commit;

select task_id, user_id, period_key, status, task_type, note
from public.task_submissions where user_id = :'C';
\echo '(period_key HILE-ANAHTARI degil, once olmali: trigger ezdi)'
\echo '(task_type continuous olmali: trigger denormalize etti)'

\echo ''
\echo '-- SUREKLI gorevde ikinci teslim ACILABILMELI (D24 R2)'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
insert into public.task_submissions (task_id, user_id, note)
values (:'T1', :'C', 'surekli gorevde ikinci teslim');
\echo '(yukaridaki INSERT 1 olmali -- hata BEKLENMIYOR)'
rollback;

\echo ''
\echo '-- DONEMSEL gorevde ayni donemde ikinci teslim ENGELLI'
insert into public.tasks (id, municipality_id, category_id, type, title,
  description, xp, coin, verification, status)
values ('0000f1a5-0000-4000-8000-0000000000d9', null,
  (select id from public.task_categories limit 1), 'daily',
  'Senaryo 9 gunluk gorev', 'Donemsel tekillik iddiasi icin gunluk gorev.',
  10, 5, 'photo', 'active')
on conflict do nothing;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
insert into public.task_submissions (task_id, user_id, note)
values ('0000f1a5-0000-4000-8000-0000000000d9', :'C', 'gunluk ilk teslim');
insert into public.task_submissions (task_id, user_id, note)
values ('0000f1a5-0000-4000-8000-0000000000d9', :'C', 'gunluk ikinci teslim');
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
\echo 'SENARYO 12: gorev tamamlaninca XP ve Coin yaziliyor'
\echo '=========================================================='

\set TGPS '0000f1a5-0000-4000-8000-000000000002'
\set TDAILY '0000f1a5-0000-4000-8000-000000000004'

select title, xp, coin from public.tasks where id in (:'TGPS', :'TDAILY') order by title;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select status from public.submit_task(:'TGPS', 41.013400, 28.981200);
commit;

select reason, amount from public.xp_transactions where user_id = :'C';
select reason, amount from public.coin_transactions where user_id = :'C';

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select total_xp from public.user_xp_balance where user_id = :'C';
select total_coin from public.user_coin_balance where user_id = :'C';
rollback;
\echo '(ilk gorev: 80 XP / 80 Coin)'

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select status from public.submit_task(:'TDAILY', 41.013400, 28.981200);
commit;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select total_xp as toplam_xp from public.user_xp_balance where user_id = :'C';
select total_coin as toplam_coin from public.user_coin_balance where user_id = :'C';
rollback;
\echo '(iki gorev toplandi: 130 XP / 130 Coin)'

\echo ''
\echo '=========================================================='
\echo 'SENARYO 13: idempotans - ayni teslim ikinci kez odul uretmez'
\echo '=========================================================='

select count(*) as xp_satiri_once from public.xp_transactions where user_id = :'C';

select public.award_task_points(s.id)
from public.task_submissions s
where s.user_id = :'C' and s.status = 'approved';

select count(*) as xp_satiri_sonra from public.xp_transactions where user_id = :'C';
select sum(amount) as toplam_xp_degismedi from public.xp_transactions where user_id = :'C';
\echo '(satir sayisi ve toplam ayni kalmali)'

\echo ''
\echo '=========================================================='
\echo 'SENARYO 14: level_from_xp esik tablosundan okuyor'
\echo '=========================================================='

select 0 as xp, * from public.level_from_xp(0);
select 130 as xp, * from public.level_from_xp(130);
select 1000 as xp, * from public.level_from_xp(1000);
select 122500 as xp, * from public.level_from_xp(122500);
\echo '(son seviyede next_level_xp bos, progress 1)'

\echo ''
\echo '=========================================================='
\echo 'SENARYO 15: esik degistirince hesap degisiyor (super_admin)'
\echo '=========================================================='

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
update public.levels set min_xp = 150 where level = 2;
\echo '(normal kullanici UPDATE: 0 satir olmali)'
rollback;

select min_xp as esik_degismedi from public.levels where level = 2;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
update public.levels set min_xp = 150 where level = 2;
\echo '(super_admin UPDATE: 1 satir olmali)'
commit;

select level, min_xp as yeni_esik from public.levels where level = 2;
select 120 as xp, level as yeni_hesap from public.level_from_xp(120);
\echo '(120 XP artik Lv.1)'

update public.levels set min_xp = 100 where level = 2;
select 120 as xp, level as geri_alindi from public.level_from_xp(120);
\echo '(esik geri alindi, 120 XP tekrar Lv.2)'

\echo ''
\echo '=========================================================='
\echo 'SENARYO 16: puan islemleri RLS'
\echo '=========================================================='

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select count(*) as b_nin_gordugu_xp_satiri from public.xp_transactions;
select count(*) as b_nin_gordugu_bakiye_satiri from public.user_xp_balance;
rollback;
\echo '(B baskasinin puanini gormemeli: 0)'

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select count(*) as c_nin_gordugu_xp_satiri from public.xp_transactions;
rollback;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select count(*) as super_adminin_gordugu_xp_satiri from public.xp_transactions;
rollback;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
insert into public.xp_transactions (user_id, amount, reason) values (:'C', 99999, 'adjustment');
\echo '(yukarida yetki hatasi bekleniyor: client puan yazamaz)'
rollback;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 17: bildirimler yalnizca sahibine gorunur'
\echo '=========================================================='

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select count(*) as b_nin_gordugu_bildirim from public.notifications;
rollback;
\echo '(B baskasinin bildirimini gormemeli)'

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select public.notify(:'C', 'system', 'sahte bildirim', null, null);
\echo '(yukarida yetki hatasi bekleniyor: client bildirim uretemez)'
rollback;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 18: rozetler herkese acik, kazanim yazilamaz'
\echo '=========================================================='

begin;
select set_config('request.jwt.claims', '', true);
set local role anon;
select count(*) as anon_gordugu_rozet from public.badges;
rollback;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
insert into public.user_badges (user_id, badge_id)
select :'C', id from public.badges limit 1;
\echo '(yukarida yetki hatasi bekleniyor: rozet kazanimi elle yazilamaz)'
rollback;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 19: bildirim (problem) yazimi yalnizca fonksiyondan'
\echo '=========================================================='

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
insert into public.problem_reports (user_id, category_id, kind, title, description)
values (:'C', 1, 'problem', 'elle yazma', 'dogrudan insert denemesi uzun aciklama');
\echo '(yukarida yetki hatasi bekleniyor)'
rollback;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select kind, status from public.report_problem('oneri', 1, 'Test önerisi',
  'Bu bir test önerisidir ve yeterince uzundur.');
commit;

select reason, amount from public.xp_transactions
where user_id = :'C' and reason = 'problem_report';

\echo ''
\echo '=========================================================='
\echo 'SENARYO 20: odul havuzu ve kupon'
\echo '=========================================================='

begin;
select set_config('request.jwt.claims', '', true);
set local role anon;
select count(*) as anon_gordugu_odul from public.rewards;
rollback;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
insert into public.reward_redemptions (reward_id, user_id, code)
select id, :'C', 'ELLEYAZ' from public.rewards limit 1;
\echo '(yukarida yetki hatasi bekleniyor: kupon elle yazilamaz)'
rollback;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 21: siralama definer ile calisiyor'
\echo '=========================================================='

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select count(*) as siralamada_gorunur_kullanici from public.leaderboard_top('turkiye','all',10);
select count(*) as ham_xp_satiri_baskasinin from public.xp_transactions
  where user_id <> '00000000-0000-0000-0000-00000000000c';
rollback;
\echo '(siralama dolu olabilir ama baskasinin ham islemi 0 gorunmeli)'

\echo ''
\echo '=========================================================='
\echo 'SENARYO 22: arkadaslik -- profil karti gizliligi'
\echo '=========================================================='

update public.profiles set username = 'rls_a' where id = :'A';
update public.profiles set username = 'rls_b' where id = :'B';
update public.profiles set username = 'rls_c' where id = :'C';

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
\echo '-- B, C nin kartina bakiyor (arkadas DEGIL): xp ve rozet bos olmali'
select is_friend, total_xp is null as xp_gizli, badge_count is null as rozet_gizli
from public.get_profile_card('rls_c');
rollback;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select status from public.send_friend_request('rls_c');
commit;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select public.respond_friend_request(
  (select id from public.friendships where requester_id = :'B' and addressee_id = :'C'),
  true);
commit;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
\echo '-- kabul sonrasi ayni kart: artik gorunur olmali'
select is_friend, total_xp is not null as xp_gorunur, badge_count is not null as rozet_gorunur
from public.get_profile_card('rls_c');
rollback;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
\echo '-- A taraf degil: iliskiyi gormemeli (0) ve elle yazamamali'
select count(*) as a_gordugu_iliski from public.friendships;
insert into public.friendships (requester_id, addressee_id)
values (:'A', :'B');
\echo '(yukarida yetki hatasi bekleniyor)'
rollback;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 23: takim -- bonus idempotent, baska takim gorunmez'
\echo '=========================================================='

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select (public.create_team('RLS Takimi', 'shield')).name as kurulan_takim;
commit;

select invite_code as rlskod from public.teams where name = 'RLS Takimi' \gset

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select (public.join_team(:'rlskod')).name as katilinan;
commit;

\echo '-- takimsiz A takim gorevine teslim gonderemez'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select public.submit_task('0000f1a5-0000-4000-8000-0000000000e2'::uuid, 41.013400, 28.981200, null);
rollback;

\echo '-- B teslim: bonus yok (esik 2, tek kisi)'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select (public.submit_task('0000f1a5-0000-4000-8000-0000000000e2'::uuid, 41.013400, 28.981200, null)).status as b_durum;
commit;
select count(*) as bonus_satiri_esik_oncesi from public.xp_transactions where reason = 'team_bonus';

\echo '-- C teslim: esik doldu, iki uyeye de bonus'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select (public.submit_task('0000f1a5-0000-4000-8000-0000000000e2'::uuid, 41.013400, 28.981200, null)).status as c_durum;
commit;
select count(*) as bonus_satiri_esik_sonrasi from public.xp_transactions where reason = 'team_bonus';

\echo '-- award_task_points tekrar: kopya olusmamali (hala 2)'
select public.award_task_points(id) from public.task_submissions
 where task_id = '0000f1a5-0000-4000-8000-0000000000e2'::uuid;
select count(*) as bonus_satiri_tekrar_sonrasi from public.xp_transactions where reason = 'team_bonus';

\echo '-- A baska takimin satirlarini gormemeli (0/0)'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select count(*) as a_gordugu_takim from public.teams;
select count(*) as a_gordugu_uyelik from public.team_members;
rollback;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 24: destek -- talep yalitimi'
\echo '=========================================================='

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select (public.create_ticket('RLS destek testi',
  'Bu talebi yalnizca sahibi ve super admin gorebilmeli.')).status as durum;
commit;

select id as destek_tid from public.support_tickets order by created_at desc limit 1 \gset

\echo '-- B (sahibi degil, super admin degil): 0 talep, 0 mesaj, yanit yok'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select count(*) as b_gordugu_talep from public.support_tickets;
select count(*) as b_gordugu_mesaj from public.ticket_messages;
select count(*) as b_kuyrugu from public.list_all_tickets(null);
select public.reply_ticket(:'destek_tid'::uuid, 'araya giriyorum');
rollback;

\echo '-- A super admin (SENARYO 6 dan beri): kuyrugu gormeli'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select subject, status, username from public.list_all_tickets(null);
rollback;

\echo '-- super admin yaniti: answered + support_reply bildirimi'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select (public.reply_ticket(:'destek_tid'::uuid, 'Merhaba, inceledik.')).is_staff as personel_mi;
commit;
select status from public.support_tickets where id = :'destek_tid'::uuid;
select type from public.notifications where user_id = :'C' order by created_at desc limit 1;

\echo '-- dogrudan insert kapali'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
insert into public.support_tickets (user_id, subject) values (:'C', 'elle yazma');
\echo '(yukarida yetki hatasi bekleniyor)'
rollback;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 25: duyuru -- hedefleme ve yetki'
\echo '=========================================================='

-- A super_admin (SENARYO 6 dan beri). B ve C normal kullanici.
-- Test belediyesi SENARYO 0 da siliniyor.
insert into public.municipalities (name, slug, level, province_id)
values ('RLS Duyuru Bld', 'rls-duyuru-bld', 'district', 34)
on conflict (slug) do nothing;

select id as rlsmuni from public.municipalities where slug = 'rls-duyuru-bld' \gset

update public.profiles set municipality_id = :'rlsmuni' where id = :'B';
insert into public.user_roles (user_id, role, municipality_id)
values (:'B', 'municipality_admin', :'rlsmuni')
on conflict do nothing;

\echo '-- normal kullanici (C) duyuru gonderemez'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select public.send_announcement('Korsan duyuru',
  'Normal kullanicidan duyuru gonderme denemesi metni.', 'all');
rollback;

\echo '-- personel (B) all gonderemez'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select public.send_announcement('Korsan genel',
  'Personelden tum ulkeye duyuru gonderme denemesi metni.', 'all');
rollback;

\echo '-- super admin (A) all gonderiyor: kullanici sayisi kadar bildirim'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select public.send_announcement('RLS genel duyuru',
  'Tum kullanicilara giden test duyurusu metni burada.', 'all') as gonderilen;
commit;

select
  (select count(*) from public.profiles where username is not null) as profil_sayisi,
  (select count(*) from public.notifications where title = 'RLS genel duyuru') as bildirim_sayisi,
  (select sent_count from public.announcements where title = 'RLS genel duyuru') as kayitli_sayi;

\echo '-- C duyuru satirlarini goremiyor (0) ve elle yazamiyor'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select count(*) as c_gordugu_duyuru from public.announcements;
select count(*) as c_gecmis from public.list_announcements(null);
insert into public.announcements (title, body, audience, created_by)
values ('elle', 'elle yazma denemesi metni', 'all', :'C');
\echo '(yukarida yetki hatasi bekleniyor)'
rollback;

\echo '-- C nin canindaki okunmamis sayaci arttı mi'
select count(*) as c_okunmamis_duyuru from public.notifications
 where user_id = :'C' and type = 'announcement' and is_read = false;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 26: topluluk -- kanal izolasyonu'
\echo '=========================================================='

/*
  Yalitim sinamasi YETKISIZ kullanici ile yapilmali.
  A, SENARYO 6 dan beri super_admin; tum kanallari gormesi ve
  raporlayabilmesi dogru davranis, izolasyon kaniti degil.
  Bu yuzden yazan B, disaridaki C (hicbir rolu yok).
*/
/*
  D29: kanal cozumu ILCE'den IL'e gecti (M28). Iki kullanici AYRI
  ILLERE dusmeli; ayni ilin iki ilcesi artik ayni kanal demek ve
  izolasyon iddiasi anlamsizlasiyordu (olculdu: suite 28 -> 31 ERROR
  ve bir iddia sessizce kayboldu).

  Not: \gset kolon takma adlarini KUCUK HARFE ceviriyor; bu yuzden
  :'il1' kucuk yazilmak zorunda (D03'te olculmustu).
*/
select id as il1 from public.provinces where name = 'İstanbul' \gset
select id as il2 from public.provinces where name = 'Ankara' \gset

update public.profiles set province_id = :'il1',
  district_id = (select id from public.districts where province_id = :'il1' order by name limit 1)
 where id = :'B';
update public.profiles set province_id = :'il2',
  district_id = (select id from public.districts where province_id = :'il2' order by name limit 1)
 where id = :'C';

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
\echo '-- B kendi kanalinda mesaj yaziyor'
select (public.post_message('RLS testi: bu mesaj yalnizca kendi ilcemde gorunmeli.')).body as yazilan;
\echo '-- B kendi mesajini goruyor (1 olmali)'
select count(*) as b_gordugu_mesaj from public.list_channel_messages(100);
select count(*) as b_gordugu_kanal from public.channels;
commit;

\echo '-- C BASKA ilce, yetkisiz: mesaji GORMUYOR (hepsi 0/1 olmali)'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select count(*) as c_gordugu_mesaj from public.list_channel_messages(100);
select count(*) as c_ham_tablodan from public.channel_messages;
select count(*) as c_gordugu_kanal from public.channels;
rollback;

\echo '-- C baska ilcenin mesajini raporlayamaz'
select id as rlsmsg from public.channel_messages order by created_at desc limit 1 \gset
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select public.report_message(:'rlsmsg'::uuid, 'baska ilceden');
rollback;

\echo '-- super admin (A) moderator olarak tum kanallari gorur (beklenen)'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select count(*) as a_super_gordugu_kanal from public.channels;
rollback;

\echo '-- dogrudan insert kapali'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
insert into public.channel_messages (channel_id, user_id, body)
values (public.my_channel_id(), :'B', 'elle yazma');
\echo '(yukarida yetki hatasi bekleniyor)'
rollback;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 27: quiz -- dogru cevap gizliligi'
\echo '=========================================================='

\echo '-- get_task_quiz donus tipinde correct_key YOK:'
select pg_get_function_result(oid) as get_task_quiz_donus
from pg_proc where proname = 'get_task_quiz';

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
\echo '-- kullanici sorulari goruyor'
select count(*) as gorulen_soru
from public.get_task_quiz('0000f1a5-0000-4000-8000-0000000000a1'::uuid);
\echo '-- ama HAM tabloyu okuyamiyor (0 olmali)'
select count(*) as ham_tablodan_gorunen from public.task_quiz_questions;
rollback;

\echo '-- yanlis cevap gecmiyor, puan yazilmiyor'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select passed, correct_count, total_count from public.submit_quiz(
  '0000f1a5-0000-4000-8000-0000000000a1'::uuid, '{}'::jsonb);
commit;
select count(*) as quiz_teslimi from public.task_submissions
 where user_id = :'C' and task_id = '0000f1a5-0000-4000-8000-0000000000a1'::uuid;

\echo '-- dogru cevaplarla geciyor ve puan yaziliyor'
select id as qq1 from public.task_quiz_questions
 where task_id = '0000f1a5-0000-4000-8000-0000000000a1'::uuid and sort = 1 \gset
select id as qq2 from public.task_quiz_questions
 where task_id = '0000f1a5-0000-4000-8000-0000000000a1'::uuid and sort = 2 \gset
select id as qq3 from public.task_quiz_questions
 where task_id = '0000f1a5-0000-4000-8000-0000000000a1'::uuid and sort = 3 \gset

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select passed, correct_count from public.submit_quiz(
  '0000f1a5-0000-4000-8000-0000000000a1'::uuid,
  jsonb_build_object(:'qq1', 'c', :'qq2', 'a', :'qq3', 'b'));
commit;
select status from public.task_submissions
 where user_id = :'C' and task_id = '0000f1a5-0000-4000-8000-0000000000a1'::uuid;
select amount from public.xp_transactions
 where user_id = :'C' and reason = 'task' order by created_at desc limit 1;

\echo '-- anon quiz yetkileri'
select has_function_privilege('anon', 'public.get_task_quiz(uuid)', 'execute') as anon_sorular,
       has_function_privilege('anon', 'public.submit_quiz(uuid, jsonb)', 'execute') as anon_teslim,
       has_table_privilege('anon', 'public.task_quiz_questions', 'select') as anon_ham;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 28: telefon -- bicim ve benzersizlik'
\echo '=========================================================='

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
\echo '-- gecersiz bicim reddedilmeli'
select public.set_phone('0212 555 44 33');
rollback;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
\echo '-- farkli yazimlar ayni degere normalize olmali'
select public.set_phone('0545 111 22 33') as b_telefon;
commit;
select phone as b_kayitli from public.profiles where id = :'B';

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
\echo '-- AYNI numara baska kullanicida reddedilmeli'
select public.set_phone('+90 545 111 22 33');
rollback;

\echo '-- dogrudan gecersiz yazma kisita takilmali'
update public.profiles set phone = '5451112233' where id = :'C';
\echo '(yukarida check kisiti hatasi bekleniyor)'

\echo '-- anon telefon yazamaz'
select has_function_privilege('anon', 'public.set_phone(text)', 'execute') as anon_set_phone;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 29: surekli gorevde tekrar teslim, donemsel gorevde engel'
\echo '=========================================================='

select id as ctsk from public.tasks
 where type = 'continuous' and verification = 'photo' and status = 'active'
 order by created_at limit 1 \gset

\echo '-- C ilk teslim (pending)'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
insert into public.task_submissions (task_id, user_id, status, photo_path)
values (:'ctsk'::uuid, :'C', 'pending', 'rls/c1.jpg');
commit;

\echo '-- inceleme surerken IKINCI teslim acilabilmeli'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
insert into public.task_submissions (task_id, user_id, status, photo_path)
values (:'ctsk'::uuid, :'C', 'pending', 'rls/c2.jpg');
commit;
select count(*) as continuous_acik_teslim from public.task_submissions
 where task_id = :'ctsk'::uuid and user_id = :'C';

\echo '-- DAILY gorevde ayni donemde ikinci teslim ENGELLI'
insert into public.tasks (municipality_id, category_id, type, title, description,
  xp, coin, verification, status)
values (null, (select id from public.task_categories limit 1), 'daily',
  'RLS gunluk gorev', 'Donemsel tekillik icin test gorevi metni burada.',
  10, 5, 'photo', 'active')
on conflict do nothing;
select id as dtsk from public.tasks where title = 'RLS gunluk gorev' \gset

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
insert into public.task_submissions (task_id, user_id, status, photo_path)
values (:'dtsk'::uuid, :'C', 'pending', 'rls/d1.jpg');
commit;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
insert into public.task_submissions (task_id, user_id, status, photo_path)
values (:'dtsk'::uuid, :'C', 'pending', 'rls/d2.jpg');
\echo '(yukarida tekillik hatasi bekleniyor)'
rollback;

\echo '-- iki continuous teslim ayri ayri onaylaninca IKI KEZ puan'
select id as csub1 from public.task_submissions where photo_path = 'rls/c1.jpg' \gset
select id as csub2 from public.task_submissions where photo_path = 'rls/c2.jpg' \gset
update public.task_submissions set status = 'approved' where id in (:'csub1'::uuid, :'csub2'::uuid);
select public.award_task_points(:'csub1'::uuid);
select public.award_task_points(:'csub2'::uuid);
select count(*) as task_xp_satiri from public.xp_transactions
 where user_id = :'C' and reason = 'task';
\echo '-- tekrar cagirinca kopya yok'
select public.award_task_points(:'csub1'::uuid);
select count(*) as tekrar_sonrasi from public.xp_transactions
 where user_id = :'C' and reason = 'task';

\echo ''
\echo '=========================================================='
\echo 'SENARYO 30: super admin TUM belediyelerin teslimlerini gorur'
\echo '=========================================================='

insert into public.municipalities (name, slug, level, province_id)
values ('RLS Inceleme Bld', 'rls-inc-bld', 'district', 34)
on conflict (slug) do nothing;
select id as incmuni from public.municipalities where slug = 'rls-inc-bld' \gset

insert into public.tasks (municipality_id, category_id, type, title, description,
  xp, coin, verification, status)
values (:'incmuni', (select id from public.task_categories limit 1), 'instant',
  'RLS belediye gorevi', 'Super admin gorunurlugu icin test gorevi metni.',
  30, 15, 'photo', 'active')
on conflict do nothing;
select id as mtsk from public.tasks where title = 'RLS belediye gorevi' \gset

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
insert into public.task_submissions (task_id, user_id, status, photo_path)
values (:'mtsk'::uuid, :'C', 'pending', 'rls/m1.jpg');
commit;

\echo '-- bu belediyeye ait bekleyen teslim (eski liste filtresi'
\echo '   municipality_id IS NULL aradigi icin bu satiri HIC gormuyordu):'
select count(*) as belediye_bekleyen_teslim
from public.task_submissions s
join public.tasks t on t.id = s.task_id
where s.status = 'pending' and t.municipality_id = :'incmuni';

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
\echo '-- super admin RLS altinda belediye teslimini goruyor (>=1):'
select count(*) as a_gordugu_belediye_teslimi
from public.task_submissions s
join public.tasks t on t.id = s.task_id
where s.status = 'pending' and t.municipality_id = :'incmuni';
\echo '-- ve onaylayabiliyor:'
select (public.review_submission(
  (select id from public.task_submissions where photo_path = 'rls/m1.jpg'),
  'approve')).status as sonuc;
commit;

\echo '-- yetkisiz kullanici inceleyemez'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select public.review_submission(
  (select id from public.task_submissions where photo_path = 'rls/c1.jpg'),
  'reject', 'olmaz');
rollback;

\echo ''
\echo '-- Gorevlerim: kullanici yalniz kendi teslimlerini goruyor'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select count(*) as b_gordugu_teslim from public.list_my_submissions(null);
rollback;
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select status, count(*) from public.list_my_submissions(null) group by status order by status;
rollback;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 31: surekli gorevde gunluk teslim siniri'
\echo '=========================================================='

/*
  GPS dogrulamali surekli gorev: submit_task fotograf/storage kontrolune
  takilmadan calissin.
*/
insert into public.tasks (id, municipality_id, category_id, type, title,
  description, xp, coin, verification, lat, lng, radius_m, status,
  daily_submission_limit)
values ('0000f1a5-0000-4000-8000-0000000000e9', null,
  (select id from public.task_categories limit 1), 'continuous',
  'RLS limit gorevi', 'Gunluk teslim siniri senaryosu icin gorev metni.',
  10, 5, 'gps', 41.0, 29.0, 1000, 'active', 2)
on conflict (id) do nothing;

\echo '-- limit 2: ilk iki teslim gecmeli'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select (public.submit_task('0000f1a5-0000-4000-8000-0000000000e9'::uuid, 41.0, 29.0)).status as t1;
select (public.submit_task('0000f1a5-0000-4000-8000-0000000000e9'::uuid, 41.0, 29.0)).status as t2;
commit;

\echo '-- ucuncu teslim REDDEDILMELI'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select public.submit_task('0000f1a5-0000-4000-8000-0000000000e9'::uuid, 41.0, 29.0);
rollback;

\echo '-- ertesi gun (teslimler dune tasinir) -> sayac sifirlanmali'
update public.task_submissions set created_at = now() - interval '1 day'
 where task_id = '0000f1a5-0000-4000-8000-0000000000e9';
select public.daily_submission_count(
  '0000f1a5-0000-4000-8000-0000000000e9'::uuid, :'B') as ertesi_gun_sayaci;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select (public.submit_task('0000f1a5-0000-4000-8000-0000000000e9'::uuid, 41.0, 29.0)).status as ertesi_gun_teslim;
commit;

\echo '-- reddedilen teslim sayaci doldurmaz'
update public.task_submissions set status = 'rejected'
 where task_id = '0000f1a5-0000-4000-8000-0000000000e9'
   and created_at > now() - interval '1 hour';
select public.daily_submission_count(
  '0000f1a5-0000-4000-8000-0000000000e9'::uuid, :'B') as red_sonrasi_sayac;

\echo '-- DONEMSEL gorev limitten etkilenmez (kendi tekilligi devrede)'
insert into public.tasks (id, municipality_id, category_id, type, title,
  description, xp, coin, verification, lat, lng, radius_m, status)
values ('0000f1a5-0000-4000-8000-0000000000ea', null,
  (select id from public.task_categories limit 1), 'daily',
  'RLS limit gunluk gorev', 'Donemsel tekillik korunuyor mu senaryosu.',
  10, 5, 'gps', 41.0, 29.0, 1000, 'active')
on conflict (id) do nothing;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select (public.submit_task('0000f1a5-0000-4000-8000-0000000000ea'::uuid, 41.0, 29.0)).status as gunluk_t1;
commit;
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select public.submit_task('0000f1a5-0000-4000-8000-0000000000ea'::uuid, 41.0, 29.0);
\echo '(yukarida "zaten gonderdin" bekleniyor -- limit mesaji DEGIL)'
rollback;

\echo '-- anon yetkileri'
select has_function_privilege('anon', 'public.daily_submission_count(uuid, uuid)', 'execute') as anon_sayac,
       has_function_privilege('anon', 'public.district_discover_stats()', 'execute') as anon_ilce_istatistik;

\echo ''
\echo '-- ilce istatistigi: ilcesi OLAN kullanicida satir doner'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select count(*) as ilceli_kullanici_satiri from public.district_discover_stats();
rollback;

\echo '-- ilce istatistigi: ilcesi YOKKEN bos donmeli'
/*
  Ilce A da onceki senaryolarda ayarlanmis olabilir; varsaymak yerine
  islem icinde bilerek null yapilip geri aliniyor.
*/
begin;
-- D29: kanal artik il uzerinden cozuluyor; ikisi de bosaltiliyor.
update public.profiles set district_id = null, province_id = null where id = :'B';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select count(*) as ilcesiz_kullanici_satiri from public.district_discover_stats();
rollback;

\echo ''
\echo '=========================================================='
\echo 'SENARYO 32: kimlik karti istatlari -- gizlilik ve yazma'
\echo '=========================================================='

/*
  B ve C arkadas DEGIL (SENARYO 22 de B-C arkadas olmustu; burada once
  iliskiyi kaldirip yalitimi temiz olcuyoruz, sonra geri kuruyoruz).
*/
delete from public.friendships
 where (requester_id = :'B' and addressee_id = :'C')
    or (requester_id = :'C' and addressee_id = :'B');

select public.recompute_user_stats(:'B');
select public.recompute_user_stats(:'C');

\echo '-- ARKADAS DEGILKEN: B, C nin istat satirini gormemeli'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select count(*) as b_gordugu_c_istati from public.user_stats where user_id = :'C';
select count(*) as b_gordugu_kendi from public.user_stats where user_id = :'B';
rollback;

\echo '-- get_profile_card: arkadas degilken istatlar null'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select is_friend, ovr is null as ovr_gizli, akt is null as akt_gizli
from public.get_profile_card('rls_c');
rollback;

\echo '-- ARKADAS OLUNCA gorunur'
insert into public.friendships (requester_id, addressee_id, status)
values (:'B', :'C', 'accepted')
on conflict do nothing;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select count(*) as b_gordugu_c_istati from public.user_stats where user_id = :'C';
select is_friend, ovr is not null as ovr_gorunur from public.get_profile_card('rls_c');
rollback;

\echo '-- kullanici kendi kartina YAZAMAZ'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
update public.user_stats set ovr = 99, tier = 'special' where user_id = :'B';
\echo '(yukarida yetki hatasi bekleniyor)'
rollback;

\echo '-- recompute BASKASI icin cagrilamaz'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select public.recompute_user_stats(:'C');
\echo '(yukarida yetki hatasi bekleniyor)'
rollback;

\echo '-- my_stats yalniz kendi satirini veriyor'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select user_id = :'B' as kendi_satiri from public.my_stats();
rollback;

\echo '-- istatlar 0-99 araliginda ve tier tutarli'
select
  bool_and(akt between 0 and 99 and sos between 0 and 99
           and kat between 0 and 99 and kes between 0 and 99
           and bil between 0 and 99 and azm between 0 and 99
           and ovr between 0 and 99) as aralik_tamam,
  bool_and(
    tier = case when ovr >= 85 then 'special' when ovr >= 70 then 'gold'
                when ovr >= 50 then 'silver' else 'bronze' end
  ) as kademe_tutarli
from public.user_stats;

\echo '-- HESAP SILME tetikleyici yuzunden kirilmamali'
begin;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000f7',
        '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
        'silme@t.local','x',now(),now(),now());
update public.profiles set username='silme_u', province_id=34,
  district_id=(select id from public.districts where province_id=34 order by name limit 1)
 where id='00000000-0000-0000-0000-0000000000f7';
/*
  Kanal kimligi DOGRUDAN cozuluyor.

  Once public.my_channel_id() kullanilmisti; o fonksiyon auth.uid()
  okuyor ve bu betik postgres rolunde kostugu icin null donuyordu.
  Sonuc: channel_id null -> NOT NULL ihlali -> islem abort -> DELETE hic
  calismadi, yani silme iddiasi hicbir sey sinamiyordu (olculdu).
*/
insert into public.channel_messages (channel_id, user_id, body)
select c.id, '00000000-0000-0000-0000-0000000000f7', 'x'
from public.channels c
join public.profiles p on p.province_id = c.province_id
where p.id = '00000000-0000-0000-0000-0000000000f7'
  and c.scope = 'province'
limit 1;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000f7';
/*
  psql -q komut etiketlerini bastiriyor, "DELETE 1" gorunmuyor; bu yuzden
  iddia sayilabilir bir cikti olarak yaziliyor: silme basariliysa hem
  kullanici hem istat satiri 0 olmali.
*/
select
  (select count(*) from auth.users
    where id = '00000000-0000-0000-0000-0000000000f7') as kalan_kullanici,
  (select count(*) from public.user_stats
    where user_id = '00000000-0000-0000-0000-0000000000f7') as kalan_istat;
\echo '(ikisi de 0 olmali; FK hatasi GORUNMEMELI)'
rollback;

\echo '-- anon yetkileri'
select has_function_privilege('anon', 'public.my_stats()', 'execute') as anon_my_stats,
       has_table_privilege('anon', 'public.user_stats', 'select') as anon_select,
       has_table_privilege('authenticated', 'public.user_stats', 'update') as auth_update,
       has_table_privilege('authenticated', 'public.user_stats', 'insert') as auth_insert;

\echo ''
\echo '=========================================================='
\echo 'SON DURUM: provinces sayisi degismemis olmali (81)'
\echo '=========================================================='
select count(*) as provinces_toplam from public.provinces;
select count(*) as profiles_toplam from public.profiles;
