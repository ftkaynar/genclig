-- M27: İstat decay (dinamik düşüş) + soğuma uyarısı.
--
-- KAVRAM: altı istat statik değil. Kullanıcı "kasıp bırakınca" kart olduğu
-- gibi kalmamalı; ama düşüş demoralize etmemeli ve kazanılmış hiçbir şeyi
-- (rozet, XP, seviye) yok etmemeli.
--
-- ---------------------------------------------------------------------------
-- MİMARİ KARARI: decay OKUMA ANINDA hesaplanıyor, satıra yazılmıyor.
-- ---------------------------------------------------------------------------
-- user_stats satırındaki değerler TABAN (decay'siz) olarak duruyor; okuyan
-- fonksiyonlar son aktifliğe göre çarpanı uyguluyor.
--
-- Denenen ve elenen alternatif 1 — pg_cron ile gecelik toplu recompute:
--   pg_cron yerelde kurulu değil (pg_available_extensions'ta var, pg_extension'da
--   yok — ölçüldü), bulutta ayrıca açılması gerekiyor ve yerel/bulut ayrışıyor.
--   Daha önemlisi: gecelik job uygulamayı hiç açmayan binlerce kullanıcı için de
--   hesap yapar, bu ölçekte saf israf. Ve 03:00'te sessizce düşen bir job'ı fark
--   etmek, satır içi bir çağrının patlamasını fark etmekten çok daha zor.
--
-- Denenen ve elenen alternatif 2 — "stale ise satıra decay'li değer yaz":
--   Kullanıcı 40 gündür uygulamayı açmadıysa satırı kimse tazelemiyor ve
--   ARKADAŞI onun kartına baktığında eski (yüksek) istatları görüyor. Decay'in
--   yazıya bağlı olması decay'i görünmez kılıyordu. Okuma anında hesaplayınca
--   her bakan doğru değeri görüyor ve kullanıcı bir görev tamamlar tamamlamaz
--   istat ANINDA toparlıyor — bir sonraki job'ı beklemiyor.
--
-- Bedeli: taban değerler tazelenmeli. Bunu my_stats() yapıyor — computed_at
-- 24 saatten eskiyse taban yeniden hesaplanıyor. Zaten her puan yazımında da
-- tetikleniyor.
--
-- BORÇ: kullanıcı sayısı büyürse ve "kimse bakmasa da doğru olsun" gereği
-- doğarsa (toplu rapor, e-posta kampanyası) pg_cron ile gecelik bir TABAN
-- recompute işi eklenmeli. Decay mantığı değişmeden kalır.

-- ---------------------------------------------------------------------------
-- 1. Şema
-- ---------------------------------------------------------------------------

/*
  last_activity_at: decay'in dayandığı tek zaman. Onaylı teslim, sorun
  bildirimi, kanal mesajı ve kabul edilmiş arkadaşlıktan en yenisi.
  Ayrı bir "son giriş" alanı KULLANILMIYOR: uygulamayı açıp hiçbir şey
  yapmamak aktiflik sayılmamalı, yoksa decay'i durdurmak bedava olurdu.

  level_score: OVR harmanındaki seviye payı (least(99, level * 2)).
  Saklanıyor çünkü decay OVR'yi yeniden kuruyor ve bunu tablo okumadan
  yapabilmesi gerekiyor — okuma anında çalışan bir fonksiyonun her kart
  için xp_transactions taraması yapması gereksiz maliyetti.

  decay_notified_at: soğuma uyarısı 7 günde bir en fazla.
*/
alter table public.user_stats
  add column if not exists last_activity_at timestamptz,
  add column if not exists level_score smallint not null default 0,
  add column if not exists decay_notified_at timestamptz;

-- Bildirim tipine 'stat_decay' ekleniyor.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'submission_approved', 'submission_rejected', 'badge_earned',
    'problem_status', 'reward_redeemed', 'system',
    'friend_request', 'friend_accepted', 'team_invite', 'support_reply',
    'announcement', 'community', 'stat_decay'
  ));

-- ---------------------------------------------------------------------------
-- 2. Decay eğrisi
-- ---------------------------------------------------------------------------

/*
  Ayarlanabilir sabitler tek yerde. Oranları değiştirmek için yalnızca bu
  fonksiyonu replace etmek yeterli; çağıranların hiçbiri değişmiyor.

    grace_days = 7    -> bu güne kadar hiç düşüş yok
    step_days  = 30   -> 7-30 arası "kademeli" bölge
    floor_days = 90   -> bu günden sonra düşüş durur (TABAN)
    step_loss  = 0.20 -> 30. güne kadarki kayıp payı
    floor_loss = 0.55 -> 90. güne kadarki toplam kayıp payı

  Tam duyarlı (p_sensitivity = 1) bir istat:
      0-7 gün -> %100     30. gün -> %80     90+ gün -> %45 (taban)

  Taban neden 0 değil: istat "şu an ne kadar aktifsin" değil, "neler
  yaptın"ın aktiflikle ölçeklenmiş hâli. Sıfıra çökmek geçmişi silmek
  olurdu ve geri dönen kullanıcıyı sıfırdan başlıyormuş gibi karşılardı.

  Duyarlılık istat başına (p_sensitivity, 0-1):
    AKT 1.00  - doğrudan "aktiflik" istatı; en duyarlı olan bu olmalı
    AZM 0.80  - süreklilik istatı; bırakınca anlamını yitiriyor
    SOS 0.60  - arkadaşlık kalıcı, ama sohbet/takım katkısı tazeliğe bağlı
    KEŞ 0.50  - gezilen yer/kategori kalıcı, ama keşif tazelik ister
    BİL 0.40  - öğrenilen bilgi büyük ölçüde kalıcı
    KAT 0.15  - şehre yapılan KALICI katkı; neredeyse hiç düşmemeli
*/
create or replace function public.stat_decay_factor(
  p_last_activity timestamptz,
  p_sensitivity numeric
)
returns numeric
language sql
stable
set search_path = ''
as $$
  with c as (
    select
      7::numeric    as grace_days,
      30::numeric   as step_days,
      90::numeric   as floor_days,
      0.20::numeric as step_loss,
      0.55::numeric as floor_loss,
      case
        when p_last_activity is null then 0::numeric
        else greatest(
          0,
          (extract(epoch from (now() - p_last_activity)) / 86400.0)::numeric
        )
      end as days
  )
  select greatest(0, least(1,
    1 - least(greatest(coalesce(p_sensitivity, 0), 0), 1) * (
      case
        when days <= grace_days then 0
        when days <= step_days then
          step_loss * (days - grace_days) / (step_days - grace_days)
        when days < floor_days then
          step_loss
          + (floor_loss - step_loss) * (days - step_days)
            / (floor_days - step_days)
        else floor_loss
      end
    )
  ))
  from c;
$$;

grant execute on function public.stat_decay_factor(timestamptz, numeric)
  to anon, authenticated;

/** Bir istatı duyarlılığına göre soğutur. */
create or replace function public.stat_decayed(
  p_value smallint,
  p_last_activity timestamptz,
  p_sensitivity numeric
)
returns smallint
language sql
stable
set search_path = ''
as $$
  select greatest(0, least(99, round(
    coalesce(p_value, 0)
    * public.stat_decay_factor(p_last_activity, p_sensitivity)
  )::integer))::smallint;
$$;

grant execute on function public.stat_decayed(smallint, timestamptz, numeric)
  to anon, authenticated;

/*
  Taban satırı alıp soğutulmuş satır döndürür.

  OVR ve kademe de YENİDEN hesaplanıyor: yalnız istatları soğutup OVR'yi
  taban değerde bırakmak, kartın üstündeki büyük sayı ile altındaki
  istatların birbirini tutmaması demekti. Harman M26'daki ile aynı
  (%60 istat ortalaması + %40 seviye payı); seviye payı decay'e TABİ
  DEĞİL — XP kazanılmış ve geri alınmıyor.
*/
create or replace function public.stats_with_decay(p_row public.user_stats)
returns public.user_stats
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_row.user_id is null then
    return p_row;
  end if;

  p_row.akt := public.stat_decayed(p_row.akt, p_row.last_activity_at, 1.00);
  p_row.azm := public.stat_decayed(p_row.azm, p_row.last_activity_at, 0.80);
  p_row.sos := public.stat_decayed(p_row.sos, p_row.last_activity_at, 0.60);
  p_row.kes := public.stat_decayed(p_row.kes, p_row.last_activity_at, 0.50);
  p_row.bil := public.stat_decayed(p_row.bil, p_row.last_activity_at, 0.40);
  p_row.kat := public.stat_decayed(p_row.kat, p_row.last_activity_at, 0.15);

  p_row.ovr := least(99, round(
    0.6 * ((p_row.akt + p_row.sos + p_row.kat + p_row.kes + p_row.bil
            + p_row.azm) / 6.0)
    + 0.4 * greatest(0, coalesce(p_row.level_score, 0))
  ))::smallint;

  p_row.tier := case
    when p_row.ovr >= 85 then 'special'
    when p_row.ovr >= 70 then 'gold'
    when p_row.ovr >= 50 then 'silver'
    else 'bronze'
  end;

  return p_row;
end;
$$;

grant execute on function public.stats_with_decay(public.user_stats)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3. recompute: taban + son aktiflik + seviye payı
-- ---------------------------------------------------------------------------

/*
  M26'daki gövde korunuyor; iki ek var:
    - v_last_activity hesaplanıp saklanıyor
    - level_score ayrı bir kolona yazılıyor (decay OVR'yi yeniden kurabilsin)

  Fonksiyon bütün olarak yeniden yazılıyor: gövdenin ortasına ek yapmak için
  `create or replace` zaten tamamını istiyor.
*/
create or replace function public.recompute_user_stats(p_user uuid)
returns public.user_stats
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_approved integer;
  v_streak integer;
  v_friends integer;
  v_in_team integer;
  v_messages integer;
  v_social_tasks integer;
  v_reports integer;
  v_resolved integer;
  v_gps_tasks integer;
  v_categories integer;
  v_quiz integer;
  v_knowledge_tasks integer;
  v_hard integer;
  v_medium integer;
  v_active_days integer;
  v_level integer;
  v_level_score smallint;
  v_last_activity timestamptz;
  v_akt smallint;
  v_sos smallint;
  v_kat smallint;
  v_kes smallint;
  v_bil smallint;
  v_azm smallint;
  v_ovr smallint;
  v_tier text;
  v_row public.user_stats;
begin
  /*
    Kullanıcı yoksa hiç hesaplama.

    ÖLÇÜLEN HATA (M26): hesap silinince team_members satırları cascade ile
    siliniyor ve AFTER DELETE tetikleyicisi bu fonksiyonu çağırıyordu. O anda
    auth.users satırı çoktan gitmiş oluyor, insert fkey ihlaliyle patlıyor ve
    KULLANICI SİLME KIRILIYORDU.
  */
  if p_user is null
     or not exists (select 1 from auth.users where id = p_user) then
    return v_row;
  end if;

  -- ----------------------------------------------------------- AKT
  select count(*) into v_approved
  from public.task_submissions
  where user_id = p_user and status = 'approved';

  with days as (
    select distinct
      (created_at at time zone 'Europe/Istanbul')::date as d
    from public.task_submissions
    where user_id = p_user and status = 'approved'
  ),
  grouped as (
    select d, d - (row_number() over (order by d))::integer as grp
    from days
  )
  select coalesce(max(cnt), 0) into v_streak
  from (select count(*) as cnt from grouped group by grp) s;

  v_akt := public.stat_curve(v_approved + 2 * v_streak, 0.055);

  -- ----------------------------------------------------------- SOS
  select count(*) into v_friends
  from public.friendships
  where status = 'accepted'
    and (requester_id = p_user or addressee_id = p_user);

  select case when exists (
    select 1 from public.team_members where user_id = p_user
  ) then 5 else 0 end into v_in_team;

  select least(count(*), 20) into v_messages
  from public.channel_messages
  where user_id = p_user and is_deleted = false;

  select count(*) into v_social_tasks
  from public.task_submissions s
  join public.tasks t on t.id = s.task_id
  left join public.task_categories c on c.id = t.category_id
  where s.user_id = p_user and s.status = 'approved'
    and (c.slug = 'social' or t.scope = 'team');

  v_sos := public.stat_curve(
    3 * v_friends + v_in_team + v_messages / 2.0 + 3 * v_social_tasks,
    0.075
  );

  -- ----------------------------------------------------------- KAT
  select
    count(*),
    count(*) filter (where status = 'resolved')
  into v_reports, v_resolved
  from public.problem_reports
  where user_id = p_user;

  v_kat := public.stat_curve(v_reports + 2 * v_resolved, 0.13);

  -- ----------------------------------------------------------- KEŞ
  select count(distinct s.task_id) into v_gps_tasks
  from public.task_submissions s
  join public.tasks t on t.id = s.task_id
  where s.user_id = p_user and s.status = 'approved'
    and t.verification in ('gps', 'photo_gps');

  select count(distinct t.category_id) into v_categories
  from public.task_submissions s
  join public.tasks t on t.id = s.task_id
  where s.user_id = p_user and s.status = 'approved'
    and t.category_id is not null;

  v_kes := public.stat_curve(v_gps_tasks + 4 * v_categories, 0.10);

  -- ----------------------------------------------------------- BİL
  select count(*) into v_quiz
  from public.task_submissions s
  join public.tasks t on t.id = s.task_id
  where s.user_id = p_user and s.status = 'approved'
    and t.verification = 'quiz';

  select count(*) into v_knowledge_tasks
  from public.task_submissions s
  join public.tasks t on t.id = s.task_id
  join public.task_categories c on c.id = t.category_id
  where s.user_id = p_user and s.status = 'approved'
    and c.slug in ('education', 'culture');

  v_bil := public.stat_curve(3 * v_quiz + 2 * v_knowledge_tasks, 0.12);

  -- ----------------------------------------------------------- AZM
  select
    count(*) filter (where t.difficulty = 'hard'),
    count(*) filter (where t.difficulty = 'medium')
  into v_hard, v_medium
  from public.task_submissions s
  join public.tasks t on t.id = s.task_id
  where s.user_id = p_user and s.status = 'approved';

  select count(distinct (created_at at time zone 'Europe/Istanbul')::date)
  into v_active_days
  from public.task_submissions
  where user_id = p_user
    and status = 'approved'
    and created_at >= now() - interval '30 days';

  v_azm := public.stat_curve(3 * v_hard + v_medium + v_active_days, 0.07);

  -- ----------------------------------------------------- son aktiflik
  /*
    Dört gerçek eylem kaynağının en yenisi. "Uygulamayı açtı" burada yok:
    decay'i sadece açarak durdurmak, decay'i anlamsız kılardı.
  */
  select max(ts) into v_last_activity from (
    select max(created_at) as ts from public.task_submissions
      where user_id = p_user and status = 'approved'
    union all
    select max(created_at) from public.problem_reports where user_id = p_user
    union all
    select max(created_at) from public.channel_messages
      where user_id = p_user and is_deleted = false
    union all
    select max(coalesce(responded_at, created_at)) from public.friendships
      where status = 'accepted'
        and (requester_id = p_user or addressee_id = p_user)
  ) sources;

  -- ----------------------------------------------------------- OVR
  select l.level into v_level
  from public.level_from_xp(
    coalesce((select sum(amount)::integer from public.xp_transactions
               where user_id = p_user), 0)
  ) l;

  v_level_score := least(99, coalesce(v_level, 1) * 2)::smallint;

  /*
    OVR harmanı: %60 istat ortalaması + %40 seviye. Burada TABAN OVR
    yazılıyor; okuma anında stats_with_decay aynı harmanı soğutulmuş
    istatlarla yeniden kuruyor.
  */
  v_ovr := least(
    99,
    round(
      0.6 * ((v_akt + v_sos + v_kat + v_kes + v_bil + v_azm) / 6.0)
      + 0.4 * v_level_score
    )
  )::smallint;

  v_tier := case
    when v_ovr >= 85 then 'special'
    when v_ovr >= 70 then 'gold'
    when v_ovr >= 50 then 'silver'
    else 'bronze'
  end;

  insert into public.user_stats (
    user_id, akt, sos, kat, kes, bil, azm, ovr, tier,
    last_activity_at, level_score, computed_at
  )
  values (
    p_user, v_akt, v_sos, v_kat, v_kes, v_bil, v_azm, v_ovr, v_tier,
    v_last_activity, v_level_score, now()
  )
  on conflict (user_id) do update set
    akt = excluded.akt, sos = excluded.sos, kat = excluded.kat,
    kes = excluded.kes, bil = excluded.bil, azm = excluded.azm,
    ovr = excluded.ovr, tier = excluded.tier,
    last_activity_at = excluded.last_activity_at,
    level_score = excluded.level_score,
    computed_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.recompute_user_stats(uuid) from public;
revoke all on function public.recompute_user_stats(uuid) from anon;
revoke all on function public.recompute_user_stats(uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- 4. Okuma kapıları: decay burada uygulanıyor
-- ---------------------------------------------------------------------------

/*
  Kendi istatların.

  Üç iş yapıyor:
    1. Taban 24 saatten eskiyse yeniden hesaplıyor (scheduler'ın yerini
       tutan tek yer).
    2. Soğuma uyarısını gerekiyorsa gönderiyor.
    3. Soğutulmuş satırı döndürüyor.

  STALE_HOURS neden 24: taban yalnızca yeni onaylı teslim/bildirim/mesaj
  geldiğinde değişir ve bunların hepsi zaten recompute'u tetikliyor. 24
  saatlik tazeleme, tetikleyicinin kaçırdığı durumlar (elle DB düzeltmesi,
  geçmişe dönük onay) için ağ.
*/
create or replace function public.my_stats()
returns public.user_stats
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.user_stats;
  v_days numeric;
begin
  if v_uid is null then
    return v_row;
  end if;

  select * into v_row from public.user_stats where user_id = v_uid;

  if v_row.user_id is null
     or v_row.computed_at < now() - interval '24 hours' then
    v_row := public.recompute_user_stats(v_uid);
  end if;

  if v_row.user_id is null then
    return v_row;
  end if;

  /*
    Soğuma uyarısı.

    Eşik 5 gün: decay 7. günde başlıyor, uyarı DÜŞÜŞ BAŞLAMADAN önce
    gelmeli ki kullanıcı önleyebilsin. Ceza bildirimi değil, hatırlatma.

    Spam koruması: aynı uyarı 7 günde bir en fazla. pg_cron olmadığı için
    tetikleyici kullanıcının uygulamayı açması; bu yüzden zaman kontrolü
    şart, yoksa her sayfa yüklemesinde bildirim düşerdi.
  */
  v_days := extract(epoch from (now() - coalesce(
    v_row.last_activity_at, now()
  ))) / 86400.0;

  if v_days >= 5
     and (v_row.decay_notified_at is null
          or v_row.decay_notified_at < now() - interval '7 days') then
    perform public.notify(
      v_uid,
      'stat_decay',
      'Kartın soğumaya başladı!',
      'Bir görev tamamla, istatların düşmesin.'
    );

    update public.user_stats
    set decay_notified_at = now()
    where user_id = v_uid
    returning * into v_row;
  end if;

  return public.stats_with_decay(v_row);
end;
$$;

revoke all on function public.my_stats() from public;
revoke all on function public.my_stats() from anon;
grant execute on function public.my_stats() to authenticated;

/*
  Başkasının istatları (soğutulmuş).

  security invoker: görünürlük sınırı user_stats RLS politikalarında duruyor
  (kendisi + arkadaş + süper admin). Fonksiyon o sınırı tekrar yazmıyor —
  D21'den beri gizlilik sınırı tek noktada tutuluyor.
*/
create or replace function public.stats_for(p_user uuid)
returns public.user_stats
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_row public.user_stats;
begin
  select * into v_row from public.user_stats where user_id = p_user;
  return public.stats_with_decay(v_row);
end;
$$;

grant execute on function public.stats_for(uuid) to authenticated;

/*
  Arkadaş profil kartı: istatlar burada da soğutuluyor.

  Aksi hâlde 40 gündür uygulamayı açmamış bir kullanıcının kartı arkadaşına
  hâlâ eski (yüksek) değerlerle görünürdü — decay'i yazıya bağlamamanın asıl
  sebebi buydu.
*/
create or replace function public.get_profile_card(p_username text)
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  level integer,
  is_friend boolean,
  request_status text,
  total_xp integer,
  badge_count integer,
  completed_tasks integer,
  akt smallint,
  sos smallint,
  kat smallint,
  kes smallint,
  bil smallint,
  azm smallint,
  ovr smallint,
  tier text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_target uuid;
  v_friend boolean;
  v_xp integer;
  v_status text;
  v_stats public.user_stats;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  select p.id into v_target
  from public.profiles p
  where p.username = trim(p_username)::extensions.citext;

  if v_target is null then
    raise exception 'Bu kullanıcı adı bulunamadı.';
  end if;

  v_friend := public.are_friends(v_uid, v_target);

  select f.status into v_status
  from public.friendships f
  where (f.requester_id = v_uid and f.addressee_id = v_target)
     or (f.requester_id = v_target and f.addressee_id = v_uid);

  select coalesce(sum(x.amount), 0)::integer into v_xp
  from public.xp_transactions x where x.user_id = v_target;

  if v_friend then
    -- Takma ad şart: OUT parametresi `user_id` tablo kolonuyla çakışıyor
    -- ve niteliksiz yazım "column reference user_id is ambiguous" veriyor
    -- (M26'da ölçüldü).
    select us.* into v_stats
    from public.user_stats us where us.user_id = v_target;

    v_stats := public.stats_with_decay(v_stats);
  end if;

  return query
  select
    v_target,
    p.username::text,
    p.avatar_url,
    (select l.level from public.level_from_xp(v_xp) l),
    v_friend,
    coalesce(v_status, 'none'),
    case when v_friend then v_xp else null end,
    case when v_friend then
      (select count(*)::integer from public.user_badges ub
        where ub.user_id = v_target)
    else null end,
    case when v_friend then
      (select count(*)::integer from public.task_submissions s
        where s.user_id = v_target and s.status = 'approved')
    else null end,
    v_stats.akt, v_stats.sos, v_stats.kat,
    v_stats.kes, v_stats.bil, v_stats.azm,
    v_stats.ovr, v_stats.tier
  from public.profiles p
  where p.id = v_target;
end;
$$;

revoke all on function public.get_profile_card(text) from public;
revoke all on function public.get_profile_card(text) from anon;
grant execute on function public.get_profile_card(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Mevcut satırların son aktifliği doldurulsun
-- ---------------------------------------------------------------------------

/*
  Geriye dönük doldurma. last_activity_at null kalsaydı stat_decay_factor
  "0 gün" kabul edip hiç decay uygulamazdı; yani eski kullanıcılar kalıcı
  olarak muaf olurdu.

  Satır sayısı bu ölçekte küçük; büyürse toplu sorguya çevrilmeli (aynı
  borç M26'da da yazılıydı).
*/
do $$
declare
  v_user uuid;
begin
  for v_user in select user_id from public.user_stats loop
    perform public.recompute_user_stats(v_user);
  end loop;
end;
$$;
