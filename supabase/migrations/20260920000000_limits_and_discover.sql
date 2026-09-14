-- M25: sürekli görevde günlük teslim sınırı (R3) ve keşfet ilçe
-- istatistiği (K2).

-- ---------------------------------------------------------------------------
-- R3 — Sürekli görevde günlük teslim sınırı
-- ---------------------------------------------------------------------------

/*
  D24'te sürekli görevlerde açık teslim tekilliği kaldırıldı (kullanıcı
  inceleme sürerken tekrar gönderebilsin diye). Ortaya çıkan borç şuydu:
  hiçbir sınır kalmayınca tek kullanıcı aynı görevi arka arkaya defalarca
  gönderip inceleme kuyruğunu doldurabiliyordu.

  Çözüm günlük sayaç. Görev bazında ayarlanabilir; null ise varsayılan 3.
  Neden kolonda null bırakıldı: mevcut satırları toplu güncellemeye gerek
  kalmıyor ve varsayılanı değiştirmek tek yerden (fonksiyon) yapılabiliyor.
*/
alter table public.tasks
  add column if not exists daily_submission_limit integer
  check (daily_submission_limit is null or daily_submission_limit between 1 and 50);

/*
  Bugün (Europe/Istanbul) bu göreve kaç teslim gönderildi.

  Gün sınırı yerel: sunucu UTC çalışıyor ve gece yarısından sonraki
  teslimler dünün sayacına düşüyordu (aynı sorun D09'da günlük kazançta
  ölçülmüştü).

  security definer: kendi teslimlerini sayıyor ama fonksiyon submit_task
  içinden çağrıldığı için RLS bağlamından bağımsız olmalı.
*/
create or replace function public.daily_submission_count(
  p_task_id uuid,
  p_user_id uuid
)
returns integer
language sql
security definer
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.task_submissions
  where task_id = p_task_id
    and user_id = p_user_id
    and status <> 'rejected'
    and (created_at at time zone 'Europe/Istanbul')::date
        = (now() at time zone 'Europe/Istanbul')::date;
$$;

revoke all on function public.daily_submission_count(uuid, uuid) from public;
revoke all on function public.daily_submission_count(uuid, uuid) from anon;
grant execute on function public.daily_submission_count(uuid, uuid) to authenticated;

/*
  Reddedilen teslimler sayılmıyor: kullanıcı haksız yere reddedilmişse
  günü kapanmamalı. Bekleyen ve onaylanan sayılıyor.
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
  v_limit integer;
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

  if v_task.type = 'continuous' then
    -- Sürekli görevde dönemsel tekillik yok; yerine günlük sayaç var.
    v_limit := coalesce(v_task.daily_submission_limit, 3);

    if public.daily_submission_count(p_task_id, v_uid) >= v_limit then
      raise exception
        'Bu görevi bugün için yeterince gönderdin, yarın tekrar dene.';
    end if;
  elsif exists (
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

/*
  Quiz tarafı da aynı sınıra uyuyor.

  Quiz'de yalnızca GEÇİNCE satır yazıldığı için sayaç doğal olarak
  onaylanan teslimleri sayıyor; yine de sürekli quiz görevlerinde
  arka arkaya deneme yapılabilmesi için sınır uygulanıyor.
*/
create or replace function public.submit_quiz(p_task_id uuid, p_answers jsonb)
returns table (passed boolean, correct_count integer, total_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_task public.tasks;
  v_period text;
  v_total integer;
  v_correct integer;
  v_ratio numeric;
  v_row public.task_submissions;
  v_limit integer;
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

  if v_task.verification <> 'quiz' then
    raise exception 'Bu görev test görevi değil.';
  end if;

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

  if exists (
    select 1 from public.task_submissions
    where task_id = p_task_id
      and user_id = v_uid
      and period_key = v_period
      and status = 'approved'
  ) then
    raise exception 'Bu görevi zaten tamamladın.';
  end if;

  if v_task.type = 'continuous' then
    v_limit := coalesce(v_task.daily_submission_limit, 3);

    if public.daily_submission_count(p_task_id, v_uid) >= v_limit then
      raise exception
        'Bu görevi bugün için yeterince gönderdin, yarın tekrar dene.';
    end if;
  end if;

  select count(*) into v_total
  from public.task_quiz_questions where task_id = p_task_id;

  if v_total = 0 then
    raise exception 'Bu görevin soruları henüz hazır değil.';
  end if;

  select count(*) into v_correct
  from public.task_quiz_questions q
  where q.task_id = p_task_id
    and p_answers ->> q.id::text = q.correct_key;

  v_ratio := v_correct::numeric / v_total::numeric;

  if v_ratio < public.quiz_pass_ratio() then
    return query select false, v_correct, v_total;
    return;
  end if;

  insert into public.task_submissions (
    task_id, user_id, status, reviewed_at
  )
  values (p_task_id, v_uid, 'approved', now())
  returning * into v_row;

  perform public.award_task_points(v_row.id);

  return query select true, v_correct, v_total;
end;
$$;

revoke all on function public.submit_quiz(uuid, jsonb) from public;
revoke all on function public.submit_quiz(uuid, jsonb) from anon;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- K2 — Keşfet "İlçende" istatistiği
-- ---------------------------------------------------------------------------

/*
  Kullanıcının ilçesine dair özet.

  "İlçedeki aktif görev" tanımı: o ilçedeki bir belediyeye ait aktif
  görevler. Görevler ilçeye doğrudan bağlı değil (municipality_id
  üzerinden bağlanıyor), bu yüzden global görevler bu sayıya GİRMİYOR —
  "senin ilçene özel" ifadesinin anlamı bu.

  security definer: haftalık tamamlanan sayısı başka kullanıcıların
  teslimlerini de kapsıyor ve RLS onları gizliyor. Fonksiyon yalnızca
  toplu sayı döndürüyor, kimin tamamladığını sızdırmıyor.
*/
create or replace function public.district_discover_stats()
returns table (
  district_name text,
  active_tasks integer,
  weekly_completed integer,
  channel_id uuid
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_district bigint;
begin
  if v_uid is null then
    return;
  end if;

  select p.district_id into v_district
  from public.profiles p where p.id = v_uid;

  if v_district is null then
    return;
  end if;

  return query
  select
    d.name,
    (
      select count(*)::integer
      from public.tasks t
      join public.municipalities m on m.id = t.municipality_id
      where m.district_id = d.id and t.status = 'active'
    ),
    (
      select count(*)::integer
      from public.task_submissions s
      join public.profiles pr on pr.id = s.user_id
      where pr.district_id = d.id
        and s.status = 'approved'
        and s.created_at >= public.period_start('week')
    ),
    (select c.id from public.channels c
      where c.scope = 'district' and c.district_id = d.id)
  from public.districts d
  where d.id = v_district;
end;
$$;

revoke all on function public.district_discover_stats() from public;
revoke all on function public.district_discover_stats() from anon;
grant execute on function public.district_discover_stats() to authenticated;
