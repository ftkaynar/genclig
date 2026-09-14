-- Sıcak yolların indeksleri.
--
-- Hepsi okuma yolunda: RLS politikaları ve sorgular user_id / status /
-- created_at üzerinden filtreliyor, ama bu kolonların çoğunda indeks yoktu
-- ve Postgres tam tarama yapıyordu. Tablolar bugün küçük olduğu için etki
-- ölçüm hatasının içinde kalıyor; indeksler satır sayısı büyüdüğünde
-- yavaşlamayı baştan engellemek için şimdi konuluyor.
--
-- `if not exists`: bir kısmı tablo tanımında zaten olabilir (birincil
-- anahtar ya da tekil kısıt üzerinden). Tekrar yaratmak hata verirdi.

-- Teslimler: kullanıcının kendi teslimleri ve görev başına katılım sayımı.
create index if not exists task_submissions_user_idx
  on public.task_submissions (user_id);
create index if not exists task_submissions_task_status_idx
  on public.task_submissions (task_id, status);

-- Bakiye ve "bugün kazanılan": kullanıcı + tarih aralığı.
create index if not exists xp_transactions_user_created_idx
  on public.xp_transactions (user_id, created_at);
create index if not exists coin_transactions_user_created_idx
  on public.coin_transactions (user_id, created_at);

-- Çan sayacı okunmamışları sayıyor, liste tarihe göre sıralı.
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, is_read, created_at desc);

-- Panel kuyruğu belediye + duruma göre, kullanıcı geçmişi user_id'ye göre.
create index if not exists problem_reports_municipality_status_idx
  on public.problem_reports (municipality_id, status);
create index if not exists problem_reports_user_idx
  on public.problem_reports (user_id);

/*
  Arkadaşlık iki yönlü tek satırda tutuluyor; sorgular hem istek gönderen
  hem alan taraftan geliyor. Tek bir bileşik indeks ikisini de
  karşılamıyor, bu yüzden iki ayrı indeks var.
*/
create index if not exists friendships_addressee_status_idx
  on public.friendships (addressee_id, status);
create index if not exists friendships_requester_status_idx
  on public.friendships (requester_id, status);

-- Takım üyeleri takıma göre okunuyor (user_id'de zaten tekil kısıt var).
create index if not exists team_members_team_idx
  on public.team_members (team_id);

-- Görev feed'i: aktif + tip filtresi; panel listesi belediyeye göre.
create index if not exists tasks_status_type_idx
  on public.tasks (status, type);
create index if not exists tasks_municipality_idx
  on public.tasks (municipality_id);
