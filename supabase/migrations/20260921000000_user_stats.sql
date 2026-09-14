-- M26: GENÇLİG Kimlik Kartı istatları.
--
-- Altı karakter istatı (0-99) kullanıcının GERÇEK davranışından türüyor;
-- hiçbiri elle girilmiyor ve hiçbiri rastgele değil.

create table public.user_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  akt smallint not null default 0 check (akt between 0 and 99),
  sos smallint not null default 0 check (sos between 0 and 99),
  kat smallint not null default 0 check (kat between 0 and 99),
  kes smallint not null default 0 check (kes between 0 and 99),
  bil smallint not null default 0 check (bil between 0 and 99),
  azm smallint not null default 0 check (azm between 0 and 99),
  ovr smallint not null default 0 check (ovr between 0 and 99),
  tier text not null default 'bronze'
    check (tier in ('bronze', 'silver', 'gold', 'special')),
  computed_at timestamptz not null default now()
);

/*
  Ham sinyali 0-99 aralığına eğriyle taşıyan yardımcı.

      stat = round(99 * (1 - exp(-k * signal)))

  Neden doğrusal değil: doğrusal ölçekte ya tavan çok erken doluyor ya da
  ilk görevler hiçbir şey hissettirmiyordu. Üstel doyum eğrisi başta hızlı
  yükseliyor (ilk birkaç eylem görünür fark yaratıyor), sonra yavaşlıyor;
  99 kasıtlı olarak çok zor.

  `k` istat başına ayarlı: sinyali doğal olarak bol olan istatlarda (mesaj
  sayısı gibi) küçük, seyrek olanlarda (çözülen bildirim gibi) büyük.
*/
create or replace function public.stat_curve(p_signal numeric, p_k numeric)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select greatest(
    0,
    least(99, round(99 * (1 - exp(-p_k * greatest(p_signal, 0))))::integer)
  )::smallint;
$$;

grant execute on function public.stat_curve(numeric, numeric) to anon, authenticated;

/*
  Kullanıcının istatlarını yeniden hesaplar.

  security definer: sinyaller task_submissions, friendships, team_members,
  channel_messages ve problem_reports üzerinden geliyor; RLS bu tabloların
  çoğunda kullanıcıyı kendi satırlarıyla sınırlıyor ve fonksiyon başka
  kullanıcılar için de (arkadaş kabulünde karşı taraf gibi) çalışmak
  zorunda.

  Tüm gün hesapları Europe/Istanbul: sunucu UTC ve gün sınırı kayarsa
  streak yanlış çıkıyordu (aynı sınıf sorun D09 ve D25'te ölçülmüştü).
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

    ÖLÇÜLEN HATA: hesap silinince `team_members` satırları cascade ile
    siliniyor ve AFTER DELETE tetikleyicisi bu fonksiyonu çağırıyordu.
    O anda auth.users satırı çoktan gitmiş oluyor, dolayısıyla
    user_stats'a insert `user_stats_user_id_fkey` ihlaliyle patlıyor ve
    KULLANICI SİLME İŞLEMİ KIRILIYORDU.

    Koruma burada, tetikleyicilerde değil: her çağıranı birden kapsıyor.
  */
  if p_user is null
     or not exists (select 1 from auth.users where id = p_user) then
    return v_row;
  end if;

  -- ----------------------------------------------------------- AKT
  select count(*) into v_approved
  from public.task_submissions
  where user_id = p_user and status = 'approved';

  /*
    En uzun günlük seri: ardışık günleri "tarih - sıra numarası" sabit
    kalır kuralıyla grupluyoruz (klasık gaps-and-islands). Ayrı bir streak
    tablosu tutmak yerine türetmek, geçmişe dönük düzeltmelerde (bir
    teslim sonradan onaylanınca) sayının kendiliğinden doğrulanmasını
    sağlıyor.
  */
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

  -- Mesaj katkısı bilerek tavanlı: sohbeti spam'leyerek istat yükseltmek
  -- mümkün olmamalı.
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

  -- k büyük: bildirim seyrek bir eylem, birkaç tanesi görünür fark etmeli.
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

  -- ----------------------------------------------------------- OVR
  select l.level into v_level
  from public.level_from_xp(
    coalesce((select sum(amount)::integer from public.xp_transactions
               where user_id = p_user), 0)
  ) l;

  /*
    OVR harmanı: %60 istat ortalaması + %40 seviye.

    Neden ikisi birden: yalnız istat ortalaması olsaydı çok XP toplamış ama
    tek alanda yoğunlaşmış kullanıcı düşük OVR alırdı; yalnız seviye
    olsaydı kart altı istattan KOPUK olur ve istatları yükseltmenin
    karta hiçbir etkisi kalmazdı. 60/40 istat tarafını baskın tutuyor —
    kartın vaadi "ne yaptığın", "ne kadar XP topladığın" değil.

    Seviye katkısı level*2 ile ölçekleniyor (50 seviye → 100, 99'da
    kırpılıyor).
  */
  v_ovr := least(
    99,
    round(
      0.6 * ((v_akt + v_sos + v_kat + v_kes + v_bil + v_azm) / 6.0)
      + 0.4 * least(99, coalesce(v_level, 1) * 2)
    )
  )::smallint;

  v_tier := case
    when v_ovr >= 85 then 'special'
    when v_ovr >= 70 then 'gold'
    when v_ovr >= 50 then 'silver'
    else 'bronze'
  end;

  insert into public.user_stats (
    user_id, akt, sos, kat, kes, bil, azm, ovr, tier, computed_at
  )
  values (p_user, v_akt, v_sos, v_kat, v_kes, v_bil, v_azm, v_ovr, v_tier, now())
  on conflict (user_id) do update set
    akt = excluded.akt, sos = excluded.sos, kat = excluded.kat,
    kes = excluded.kes, bil = excluded.bil, azm = excluded.azm,
    ovr = excluded.ovr, tier = excluded.tier, computed_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.recompute_user_stats(uuid) from public;
revoke all on function public.recompute_user_stats(uuid) from anon;
revoke all on function public.recompute_user_stats(uuid) from authenticated;

/*
  Kullanıcının kendi istatlarını okuma/tazeleme kapısı.

  Ayrı bir fonksiyon: recompute doğrudan çağrılabilir olsaydı kullanıcı
  başka bir kullanıcının kimliğini geçirip onun istatını yeniden
  hesaplatabilirdi. Bu sarmalayıcı yalnızca çağıranın kendisi için
  çalışıyor.
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
begin
  if v_uid is null then
    return v_row;
  end if;

  select * into v_row from public.user_stats where user_id = v_uid;

  -- Hiç hesaplanmamışsa ilk okumada üretiliyor.
  if v_row.user_id is null then
    v_row := public.recompute_user_stats(v_uid);
  end if;

  return v_row;
end;
$$;

revoke all on function public.my_stats() from public;
revoke all on function public.my_stats() from anon;
grant execute on function public.my_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- Tetikleyiciler: istatları güncel tutan çağrılar
-- ---------------------------------------------------------------------------

/*
  Puan yazımının sonunda istat tazeleniyor.

  Tek kullanıcı için birkaç toplama sorgusu; ölçek bu seviyedeyken
  maliyeti ihmal edilebilir. Kullanıcı sayısı büyürse bu çağrı bir kuyruğa
  taşınmalı — şimdilik anında güncellik, arayüzde "kartım neden
  değişmedi" sorusunu tamamen ortadan kaldırıyor.
*/
create or replace function public.award_task_points(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.task_submissions;
  v_task public.tasks;
  v_team uuid;
  v_done integer;
  v_member record;
begin
  select * into v_submission
  from public.task_submissions
  where id = p_submission_id;

  if v_submission.id is null or v_submission.status <> 'approved' then
    return;
  end if;

  select * into v_task from public.tasks where id = v_submission.task_id;

  if v_task.id is null then
    return;
  end if;

  if v_task.xp > 0 then
    insert into public.xp_transactions (user_id, amount, reason, submission_id)
    values (v_submission.user_id, v_task.xp, 'task', v_submission.id)
    on conflict do nothing;
  end if;

  if v_task.coin > 0 then
    insert into public.coin_transactions (user_id, amount, reason, submission_id)
    values (v_submission.user_id, v_task.coin, 'task', v_submission.id)
    on conflict do nothing;
  end if;

  if v_task.scope = 'team'
     and (v_task.team_bonus_xp > 0 or v_task.team_bonus_coin > 0) then

    select team_id into v_team
    from public.team_members where user_id = v_submission.user_id;

    if v_team is not null then
      select count(*) into v_done
      from public.task_submissions s
      join public.team_members m on m.user_id = s.user_id
      where s.task_id = v_task.id
        and s.period_key = v_submission.period_key
        and s.status = 'approved'
        and m.team_id = v_team;

      if v_done >= coalesce(v_task.min_team_size, 2) then
        for v_member in
          select s.id as submission_id, s.user_id
          from public.task_submissions s
          join public.team_members m on m.user_id = s.user_id
          where s.task_id = v_task.id
            and s.period_key = v_submission.period_key
            and s.status = 'approved'
            and m.team_id = v_team
        loop
          if v_task.team_bonus_xp > 0 then
            insert into public.xp_transactions (user_id, amount, reason, submission_id)
            values (v_member.user_id, v_task.team_bonus_xp, 'team_bonus', v_member.submission_id)
            on conflict do nothing;
          end if;

          if v_task.team_bonus_coin > 0 then
            insert into public.coin_transactions (user_id, amount, reason, submission_id)
            values (v_member.user_id, v_task.team_bonus_coin, 'team_bonus', v_member.submission_id)
            on conflict do nothing;
          end if;

          perform public.notify(
            v_member.user_id,
            'system',
            'Takım bonusu kazandın',
            v_task.title || ' görevini takımca tamamladınız: +'
              || v_task.team_bonus_xp || ' XP • +' || v_task.team_bonus_coin || ' Coin',
            v_task.id
          );

          -- Bonus alan her üyenin kartı da tazeleniyor.
          perform public.recompute_user_stats(v_member.user_id);
        end loop;
      end if;
    end if;
  end if;

  perform public.check_and_award_badges(v_submission.user_id);
  perform public.recompute_user_stats(v_submission.user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- İlk dolum
-- ---------------------------------------------------------------------------

/*
  Mevcut tüm kullanıcılar için bir kez hesaplanıyor.

  Kullanıcı sayısı şu an çok küçük; büyük bir tabloda bu döngü yerine
  toplu bir sorgu ya da arka plan işi gerekir.
*/
do $$
declare
  v_user record;
begin
  for v_user in select id from auth.users loop
    perform public.recompute_user_stats(v_user.id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.user_stats enable row level security;

create policy user_stats_select_own on public.user_stats
  for select to authenticated using (user_id = (select auth.uid()));

-- Arkadaşlar birbirinin kartını görebiliyor; profil kartındaki gizlilik
-- sınırıyla aynı kural (D21 FAZ C).
create policy user_stats_select_friends on public.user_stats
  for select to authenticated using (
    public.are_friends((select auth.uid()), user_id)
  );

create policy user_stats_select_super on public.user_stats
  for select to authenticated using (public.is_super_admin());

/*
  Yazma politikası bilerek yok ve yazma GRANT'i de verilmiyor: istatların
  tek yazma yolu recompute_user_stats. Client doğrudan yazabilseydi
  kullanıcı kendi kartına 99 yazardı.
*/
revoke all on public.user_stats from anon, authenticated;
grant select on public.user_stats to authenticated;

-- ---------------------------------------------------------------------------
-- Diğer sinyal kaynakları: tablo tetikleyicileri
-- ---------------------------------------------------------------------------

/*
  Bildirim, arkadaşlık ve takım değişiklikleri istatları etkiliyor.

  Bu tazelemeler RPC gövdelerine `perform recompute_user_stats(...)`
  eklenerek de yapılabilirdi. Tetikleyici seçildi çünkü:
  - RPC gövdelerini bu migration'a kopyalamak gerekirdi (report_problem,
    set_problem_status, respond_friend_request, join_team, leave_team...),
    her kopya ileride ıraksama riski;
  - tetikleyici HER yazma yolunu yakalıyor — bugün aklıma gelmeyen ya da
    sonradan eklenecek bir yol da dahil.

  Denenen ve elenen alternatif: tek bir "istat bayat" işareti koyup okuma
  anında hesaplamak. Elendi, çünkü profil açılışını yavaşlatıyordu ve
  kartın "az önce yaptığım iş kartıma yansıdı mı" hissi kayboluyordu.
*/

create or replace function public.stats_touch_problem()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recompute_user_stats(
    coalesce(new.user_id, old.user_id)
  );
  return null;
end;
$$;

create trigger problem_reports_stats_trg
  after insert or update of status on public.problem_reports
  for each row execute function public.stats_touch_problem();

create or replace function public.stats_touch_friendship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Arkadaşlık iki tarafı da etkiliyor.
  perform public.recompute_user_stats(new.requester_id);
  perform public.recompute_user_stats(new.addressee_id);
  return null;
end;
$$;

create trigger friendships_stats_trg
  after insert or update of status on public.friendships
  for each row execute function public.stats_touch_friendship();

create or replace function public.stats_touch_team()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recompute_user_stats(
    coalesce(new.user_id, old.user_id)
  );
  return null;
end;
$$;

create trigger team_members_stats_trg
  after insert or delete on public.team_members
  for each row execute function public.stats_touch_team();

/*
  Topluluk mesajı da SOS sinyalinde; mesaj sıklığı yüksek olabileceği için
  yalnızca INSERT'te ve tavana ulaşılmadıysa hesaplanıyor.

  Tavan kontrolü tetikleyicide: her mesajda tam hesap yapmak, sohbeti
  yoğun bir kanalda gereksiz yük demekti. 20 mesajdan sonra SOS'un mesaj
  bileşeni zaten sabitleniyor (bkz. recompute_user_stats).
*/
create or replace function public.stats_touch_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.channel_messages
  where user_id = new.user_id and is_deleted = false;

  if v_count <= 20 then
    perform public.recompute_user_stats(new.user_id);
  end if;

  return null;
end;
$$;

create trigger channel_messages_stats_trg
  after insert on public.channel_messages
  for each row execute function public.stats_touch_message();

-- ---------------------------------------------------------------------------
-- Profil kartına istatlar
-- ---------------------------------------------------------------------------

/*
  `get_profile_card` genişliyor: arkadaşsa altı istat + OVR + kademe de
  dönüyor, arkadaş değilse hepsi null.

  Neden ayrı bir "arkadaşın istatları" fonksiyonu yazılmadı: gizlilik
  sınırı (arkadaş mı değil mi) tek yerde durmalı. İki ayrı fonksiyon
  olsaydı biri güncellenip diğeri unutulduğunda sınır sessizce
  açılabilirdi — D21'de bu sınır bilerek tek noktada toplanmıştı.
*/

-- Dönüş tipi değişiyor: `create or replace` bunu yapamıyor
-- ("cannot change return type of existing function", ölçüldü), önce
-- düşürmek gerekiyor.
drop function if exists public.get_profile_card(text);

create function public.get_profile_card(p_username text)
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
    -- Takma ad şart: fonksiyonun `user_id` OUT parametresi tablo
    -- kolonuyla çakışıyor ve niteliksiz yazım "column reference user_id
    -- is ambiguous" hatası veriyor (ölçüldü).
    select us.* into v_stats
    from public.user_stats us where us.user_id = v_target;
  end if;

  return query
  select
    v_target,
    p.username::text,
    p.avatar_url,
    (select l.level from public.level_from_xp(v_xp) l),
    v_friend,
    coalesce(v_status, 'none'),
    -- Arkadaş değilse ayrıntılar boş dönüyor.
    case when v_friend then v_xp else null end,
    case when v_friend then
      (select count(*)::integer from public.user_badges ub where ub.user_id = v_target)
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
