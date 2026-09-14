-- M24: telefon zorunluluğu (F1), sürekli görevde tekrar teslim (R2) ve
-- zamanlanmış görev seed'i (Z1).

-- ---------------------------------------------------------------------------
-- F1 — Telefon
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists phone text;

/*
  Biçim: Türkiye cep numarası, +90 ile saklanıyor (+905XXXXXXXXX).

  Neden tek biçim: kullanıcı "0532...", "532...", "+90 532 ... " gibi
  farklı yazımlarla girebiliyor ve bunları olduğu gibi saklamak
  benzersizlik kontrolünü işe yaramaz hâle getiriyordu — aynı numara üç
  farklı satır olarak geçebilirdi. Normalize etme işi sunucuda
  (set_phone), buradaki kısıt son savunma hattı.
*/
alter table public.profiles
  drop constraint if exists profiles_phone_format;
alter table public.profiles
  add constraint profiles_phone_format
  check (phone is null or phone ~ '^\+905[0-9]{9}$');

/*
  Benzersizlik kısmi indeksle: Postgres'te düz unique indeks zaten birden
  çok NULL'a izin veriyor, ama koşulu açıkça yazmak niyeti görünür kılıyor
  ve indeksi telefonu olmayan satırlar kadar küçültüyor.
*/
create unique index if not exists profiles_phone_unique
  on public.profiles (phone)
  where phone is not null;

/*
  Telefon yazma.

  security definer: benzersizlik ihlalini kullanıcıya anlamlı bir Türkçe
  mesajla döndürmek için hatayı burada yakalıyoruz; ham Postgres hatası
  ("duplicate key value violates unique constraint ...") kullanıcıya
  gösterilemezdi.

  NOT: SMS ile doğrulama bu dilimde YOK (ücretli sağlayıcı gerektiriyor).
  Şimdilik yalnızca zorunlu toplama ve biçim/benzersizlik kontrolü var;
  numaranın gerçekten kullanıcıya ait olduğu doğrulanmıyor.
*/
create or replace function public.set_phone(p_phone text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_digits text;
  v_normalized text;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  if p_phone is null or length(trim(p_phone)) = 0 then
    raise exception 'Telefon numarası zorunlu.';
  end if;

  -- Yalnızca rakamları al: boşluk, parantez, tire ve + temizleniyor.
  v_digits := regexp_replace(p_phone, '[^0-9]', '', 'g');

  /*
    Kabul edilen yazımlar tek biçime indirgeniyor:
      5XXXXXXXXX      (10 hane)
      05XXXXXXXXX     (11 hane, baştaki 0)
      905XXXXXXXXX    (12 hane, ülke kodu)
  */
  if length(v_digits) = 10 and left(v_digits, 1) = '5' then
    v_normalized := '+90' || v_digits;
  elsif length(v_digits) = 11 and left(v_digits, 2) = '05' then
    v_normalized := '+90' || right(v_digits, 10);
  elsif length(v_digits) = 12 and left(v_digits, 3) = '905' then
    v_normalized := '+' || v_digits;
  else
    raise exception 'Geçerli bir cep telefonu gir (5XX XXX XX XX).';
  end if;

  if exists (
    select 1 from public.profiles
    where phone = v_normalized and id <> v_uid
  ) then
    raise exception 'Bu telefon zaten kayıtlı.';
  end if;

  update public.profiles set phone = v_normalized where id = v_uid;

  return v_normalized;
exception
  when unique_violation then
    -- İki isteğin aynı anda gelmesi durumunda kısıt yakalar.
    raise exception 'Bu telefon zaten kayıtlı.';
end;
$$;

revoke all on function public.set_phone(text) from public;
revoke all on function public.set_phone(text) from anon;
grant execute on function public.set_phone(text) to authenticated;

-- ---------------------------------------------------------------------------
-- R2 — Sürekli görevde inceleme sürerken tekrar teslim
-- ---------------------------------------------------------------------------

/*
  Sorun: `task_submissions_open_unique` indeksi (task_id, user_id,
  period_key) üzerinde ve sürekli görevlerde period_key her zaman 'once'.
  Sonuç: kullanıcının bir teslimi incelemedeyken aynı sürekli göreve
  ikinci teslim gönderememesi. Sürekli görev tanımı gereği tekrarlanabilir
  olduğu için bu bir kısıtlama değil, hataydı.

  Seçilen yol: `task_type` kolonunu teslim satırına denormalize etmek ve
  kısmi indeksin koşuluna katmak.

  Denenen ve elenen alternatifler:
  - Sürekli görevlerde period_key'i benzersizleştirmek (zaman damgası ya da
    uuid koymak): indeks çalışırdı ama period_key'in anlamı bozulurdu —
    takım bonusu ve dönem sorguları bu alanı "aynı dönem" karşılaştırması
    için kullanıyor ve her satır farklı olunca takım eşiği hiç dolmazdı.
  - İndeksi kaldırıp kontrolü tetikleyiciye taşımak: eşzamanlı iki istek
    arasında yarış koşulu açardı; benzersiz indeks bunu veritabanı
    seviyesinde kapatıyor.

  Denormalizasyon bedava: period_key'i yazan tetikleyici zaten görevin
  tipini okuyor, aynı sorgudan tek kolon daha yazılıyor.
*/
alter table public.task_submissions
  add column if not exists task_type text;

-- Mevcut satırlar dolduruluyor.
update public.task_submissions s
set task_type = t.type
from public.tasks t
where t.id = s.task_id and s.task_type is null;

create or replace function public.task_submissions_set_period_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t_type text;
begin
  select type into t_type from public.tasks where id = new.task_id;

  if t_type is null then
    raise exception 'Görev bulunamadı.';
  end if;

  new.period_key := public.task_period_key(t_type, now());
  -- Aynı okumadan denormalize ediliyor; indeksin koşulu bunu kullanıyor.
  new.task_type := t_type;
  return new;
end;
$$;

drop index if exists public.task_submissions_open_unique;

/*
  Yeni kural: dönemsel tekillik sürekli görevler DIŞINDA korunuyor.
  daily/weekly/monthly/instant görevlerde kullanıcı dönem başına tek açık
  teslim gönderebiliyor; continuous'ta sınır yok, her teslim ayrı
  değerlendiriliyor.

  Puan mükerrerliği riski yok: award_task_points submission_id bazlı
  kısmi tekil indekslerle korunuyor, yani onaylanan her teslim bir kez
  ödüyor.
*/
create unique index task_submissions_open_unique
  on public.task_submissions (task_id, user_id, period_key)
  where status in ('pending', 'approved') and task_type <> 'continuous';

/*
  submit_task: "zaten gönderdin" kontrolü indeksle aynı kuralı izliyor.
  İkisi ayrı kalsaydı kullanıcı fonksiyondan geçip indekse çarpar ve ham
  veritabanı hatası görürdü.
*/
create or replace function public.submit_task(
  p_task_id uuid,
  p_lat double precision default null,
  p_lng double precision default null,
  p_photo_path text default null
)
returns public.task_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_task public.tasks;
  v_period text;
  v_distance double precision;
  v_status text;
  v_reviewed_at timestamptz;
  v_row public.task_submissions;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  select * into v_task from public.tasks where id = p_task_id;

  if v_task.id is null then
    raise exception 'Görev bulunamadı.';
  end if;

  if v_task.status <> 'active' then
    raise exception 'Görev aktif değil.';
  end if;

  -- Z1: başlangıç saati mesajda da görünüyor; "henüz başlamadı" tek başına
  -- kullanıcıya ne zaman geleceğini söylemiyordu.
  if v_task.starts_at is not null and v_task.starts_at > now() then
    raise exception 'Bu görev % tarihinde başlıyor.',
      to_char(v_task.starts_at at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI');
  end if;

  if v_task.ends_at is not null and v_task.ends_at < now() then
    raise exception 'Görevin süresi dolmuş.';
  end if;

  if v_task.scope = 'team'
     and not exists (select 1 from public.team_members where user_id = v_uid) then
    raise exception 'Bu görev takım görevi — önce bir takıma katıl.';
  end if;

  v_period := public.task_period_key(v_task.type, now());

  -- Sürekli görevde açık teslim engeli yok (bkz. indeks gerekçesi).
  if v_task.type <> 'continuous' and exists (
    select 1
    from public.task_submissions
    where task_id = p_task_id
      and user_id = v_uid
      and period_key = v_period
      and status in ('pending', 'approved')
  ) then
    raise exception 'Bu görevi zaten gönderdin.';
  end if;

  if v_task.capacity is not null
     and public.task_participant_count(p_task_id) >= v_task.capacity then
    raise exception 'Bu görevin kontenjanı doldu.';
  end if;

  if v_task.verification in ('gps', 'photo_gps') then
    if p_lat is null or p_lng is null then
      raise exception 'Konum bilgisi alınamadı.';
    end if;

    if v_task.lat is null or v_task.lng is null then
      raise exception 'Görevin hedef konumu tanımlı değil.';
    end if;

    v_distance := 6371000 * 2 * asin(sqrt(
      power(sin(radians(p_lat - v_task.lat) / 2), 2)
      + cos(radians(v_task.lat)) * cos(radians(p_lat))
        * power(sin(radians(p_lng - v_task.lng) / 2), 2)
    ));

    if v_distance > coalesce(v_task.radius_m, 0) then
      raise exception 'Hedefe ~% m uzaktasın.', round(v_distance)::text;
    end if;
  end if;

  if v_task.verification in ('photo', 'photo_gps') then
    if p_photo_path is null or length(trim(p_photo_path)) = 0 then
      raise exception 'Fotoğraf yüklenmedi.';
    end if;

    if not exists (
      select 1
      from storage.objects
      where bucket_id = 'task-proofs'
        and name = p_photo_path
        and owner_id = v_uid::text
    ) then
      raise exception 'Fotoğraf bulunamadı. Lütfen tekrar yükle.';
    end if;
  end if;

  if v_task.verification = 'gps' then
    v_status := 'approved';
    v_reviewed_at := now();
  else
    v_status := 'pending';
    v_reviewed_at := null;
  end if;

  insert into public.task_submissions (
    task_id, user_id, status, photo_path,
    submitted_lat, submitted_lng, distance_m, reviewed_at
  )
  values (
    p_task_id, v_uid, v_status, p_photo_path,
    p_lat, p_lng, v_distance, v_reviewed_at
  )
  returning * into v_row;

  if v_row.status = 'approved' then
    perform public.award_task_points(v_row.id);
  end if;

  return v_row;
end;
$$;

revoke all on function public.submit_task(uuid, double precision, double precision, text) from public;
revoke all on function public.submit_task(uuid, double precision, double precision, text) from anon;
grant execute on function public.submit_task(uuid, double precision, double precision, text) to authenticated;

-- ---------------------------------------------------------------------------
-- M — "Görevlerim" listesi
-- ---------------------------------------------------------------------------

/*
  Kullanıcının kendi teslimleri.

  security definer: görev başlığı, ikonu ve ödülü tasks tablosundan
  geliyor; RLS kullanıcıya taslak görevleri göstermiyor ve teslim ettiği
  bir görev sonradan taslağa alınırsa satır başlıksız kalırdı. Fonksiyon
  yalnızca çağıranın kendi tesliminlerini döndürüyor.
*/
create or replace function public.list_my_submissions(p_status text default null)
returns table (
  id uuid,
  task_id uuid,
  task_title text,
  task_icon text,
  xp integer,
  coin integer,
  status text,
  photo_path text,
  reject_reason text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return;
  end if;

  if p_status is not null and p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Geçersiz durum.';
  end if;

  return query
  select
    s.id, t.id, t.title, coalesce(t.icon, c.icon),
    t.xp, t.coin, s.status, s.photo_path, s.reject_reason,
    s.created_at, s.reviewed_at
  from public.task_submissions s
  join public.tasks t on t.id = s.task_id
  left join public.task_categories c on c.id = t.category_id
  where s.user_id = v_uid
    and (p_status is null or s.status = p_status)
  order by s.created_at desc
  limit 100;
end;
$$;

revoke all on function public.list_my_submissions(text) from public;
revoke all on function public.list_my_submissions(text) from anon;
grant execute on function public.list_my_submissions(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Z1 — Zamanlanmış görev seed'i
-- ---------------------------------------------------------------------------

insert into public.tasks (
  id, municipality_id, category_id, type, title, description, instructions,
  xp, coin, verification, icon, difficulty, lat, lng, radius_m,
  starts_at, ends_at, status
)
values (
  '0000f1a5-0000-4000-8000-0000000000b1',
  null,
  (select id from public.task_categories where slug = 'social'),
  'instant',
  'STK buluşması: sahilde fidan dikimi',
  'Gönüllü ekiple birlikte fidan dik. Etkinlik tam saatinde başlıyor.',
  'Başlangıç saatinde etkinlik alanında ol ve ekip fotoğrafını gönder.',
  150, 75, 'photo_gps', 'trees', 'medium',
  40.986500, 29.025400, 400,
  now() + interval '2 days',
  now() + interval '2 days' + interval '3 hours',
  'active'
)
on conflict do nothing;
