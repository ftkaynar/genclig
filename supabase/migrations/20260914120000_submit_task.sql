-- Görev tamamlama: teslim açma kuralları sunucuya taşınıyor.
-- Puan/coin yazımı burada YOK; yalnızca teslim satırı ve onun durumu.

-- ---------------------------------------------------------------------------
-- Tekillik: yalnızca "yaşayan" teslimler
-- ---------------------------------------------------------------------------

/*
  Eski kısıt (task_id, user_id, period_key) her durumu kapsıyordu ve reddedilen
  bir teslim aynı dönemde yeniden denemeyi kalıcı olarak kilitliyordu.

  Yerine kısmi indeks geliyor: yalnızca beklemedeki ve onaylanmış satırlar
  tekil. Böylece "aynı anda tek açık teslim" kuralı korunuyor, reddedilen kayıt
  geçmişte duruyor ve kullanıcı tekrar deneyebiliyor.
*/
alter table public.task_submissions
  drop constraint task_submissions_period_unique;

create unique index task_submissions_open_unique
  on public.task_submissions (task_id, user_id, period_key)
  where status in ('pending', 'approved');

-- ---------------------------------------------------------------------------
-- Katılım sayacı
-- ---------------------------------------------------------------------------

/*
  Kaç kişi katıldı: beklemede + onaylanmış teslimler. Reddedilenler sayılmaz;
  kontenjanı dolduran, kabul edilmiş ya da edilmeyi bekleyen katılım.

  security definer olmak zorunda: RLS kullanıcıya yalnızca kendi teslimlerini
  gösteriyor, dolayısıyla normal bir sorgu en fazla 1 döndürebiliyordu.
  Fonksiyon yalnızca bir sayı döndürüyor, hangi kullanıcıların katıldığını
  sızdırmıyor.
*/
create or replace function public.task_participant_count(p_task_id uuid)
returns integer
language sql
security definer
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.task_submissions
  where task_id = p_task_id
    and status in ('pending', 'approved');
$$;

grant execute on function public.task_participant_count(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Teslim açma
-- ---------------------------------------------------------------------------

/*
  Görev teslimi tek kapıdan geçiyor.

  Neden security definer: konum doğrulaması ve kapasite kontrolü kullanıcının
  değiştiremeyeceği bir yerde olmalı. Fonksiyon tablo sahibi yetkisiyle
  koştuğu için task_submissions üzerindeki RLS'e takılmıyor; bu bilinçli.
  RLS'in insert politikası status = 'pending' şart koşuyor, oysa konumu
  doğrulanan görev doğrudan approved açılıyor. Client'ın doğrudan insert
  yolu kapalı kalmaya devam ediyor: politika değişmedi, yalnızca bu fonksiyon
  onu aşabiliyor.

  search_path = '' ve tam nitelikli isimler: arama yolunu değiştirip sahte bir
  tasks tablosu göstererek doğrulamayı atlatma yolunu kapatıyor.

  Mesafe hesabı fonksiyon içinde haversine ile yapılıyor. Denenen ve elenen
  alternatif: postgis kurup ST_DWithin kullanmak. Elendi, çünkü tek bir nokta
  mesafesi için koca bir eklenti ve onunla gelen bakım yükü gereksiz;
  yüz metrelik yarıçaplarda haversine yeterince doğru.
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

  if v_task.starts_at is not null and v_task.starts_at > now() then
    raise exception 'Görev henüz başlamadı.';
  end if;

  if v_task.ends_at is not null and v_task.ends_at < now() then
    raise exception 'Görevin süresi dolmuş.';
  end if;

  v_period := public.task_period_key(v_task.type, now());

  if exists (
    select 1
    from public.task_submissions
    where task_id = p_task_id
      and user_id = v_uid
      and period_key = v_period
      and status in ('pending', 'approved')
  ) then
    raise exception 'Bu görevi zaten gönderdin.';
  end if;

  /*
    Kapasite kontrolü ile aşağıdaki insert arasında kilit yok: iki kişi aynı
    anda son kontenjanı alabilir ve sayı capacity'yi bir aşabilir. MVP için
    kabul edildi. Kesin çözüm görev satırını FOR UPDATE ile kilitlemek ya da
    sayacı tasks üzerinde denormalize edip kısıt koymak; ikisi de yazma
    yolunu yavaşlatıyor ve bu ölçekte karşılığı yok.
  */
  if v_task.capacity is not null
     and public.task_participant_count(p_task_id) >= v_task.capacity then
    raise exception 'Bu görevin kontenjanı doldu.';
  end if;

  -- Konum doğrulaması.
  if v_task.verification in ('gps', 'photo_gps') then
    if p_lat is null or p_lng is null then
      raise exception 'Konum bilgisi alınamadı.';
    end if;

    if v_task.lat is null or v_task.lng is null then
      raise exception 'Görevin hedef konumu tanımlı değil.';
    end if;

    -- Haversine; dünya yarıçapı 6371 km.
    v_distance := 6371000 * 2 * asin(sqrt(
      power(sin(radians(p_lat - v_task.lat) / 2), 2)
      + cos(radians(v_task.lat)) * cos(radians(p_lat))
        * power(sin(radians(p_lng - v_task.lng) / 2), 2)
    ));

    if v_distance > coalesce(v_task.radius_m, 0) then
      raise exception 'Hedefe ~% m uzaktasın.', round(v_distance)::text;
    end if;
  end if;

  -- Fotoğraf doğrulaması.
  if v_task.verification in ('photo', 'photo_gps') then
    if p_photo_path is null or length(trim(p_photo_path)) = 0 then
      raise exception 'Fotoğraf yüklenmedi.';
    end if;

    -- Dosya gerçekten yüklenmiş ve yükleyen bu kullanıcı olmalı. Aksi halde
    -- kullanıcı var olmayan bir yol yazıp teslimi kanıtsız açabilirdi.
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

  /*
    Konum görevleri otomatik onaylanıyor: doğrulama zaten sunucuda yapıldı,
    insan incelemesi bir şey eklemiyor. reviewed_by null bırakılıyor çünkü
    onaylayan bir kişi yok; reviewed_at otomatik onayın zamanını taşıyor.
    Fotoğraflı görevler insan incelemesi bekliyor, panel akışı ayrı dilimde.
  */
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

  return v_row;
end;
$$;

/*
  Yalnızca oturum açmış kullanıcılar.

  anon'dan ayrıca revoke ediliyor: PUBLIC'ten almak yetmiyor, çünkü Supabase
  public şemada oluşturulan fonksiyonlara anon ve authenticated rollerine
  doğrudan yetki veriyor. Ölçüldü: yalnızca PUBLIC revoke edildiğinde anon
  fonksiyonu çağırabiliyor ve hata veritabanı yetkisinden değil fonksiyonun
  içindeki auth.uid() kontrolünden geliyordu. İki katman da olsun diye
  fonksiyon içindeki kontrol yerinde bırakıldı.
*/
revoke all on function public.submit_task(uuid, double precision, double precision, text) from public;
revoke all on function public.submit_task(uuid, double precision, double precision, text) from anon;
grant execute on function public.submit_task(uuid, double precision, double precision, text) to authenticated;
