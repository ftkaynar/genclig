-- M29b: Dönem sonu sıralama ödülleri.
--
-- Haftanın/ayın ilk üçü XP ve Token kazanıyor. Amaç sıralamaya bir SON
-- vermek: bitmeyen bir liste, başa oynamayan kullanıcı için anlamsız.

-- ===========================================================================
-- 1. İşlem gerekçelerine yeni tip
-- ===========================================================================

alter table public.xp_transactions drop constraint xp_transactions_reason_check;
alter table public.xp_transactions add constraint xp_transactions_reason_check
  check (reason in (
    'task', 'badge', 'adjustment', 'problem_report', 'problem_resolved',
    'team_bonus', 'leaderboard_reward'
  ));

alter table public.coin_transactions drop constraint coin_transactions_reason_check;
alter table public.coin_transactions add constraint coin_transactions_reason_check
  check (reason in (
    'task', 'badge', 'reward_spend', 'adjustment', 'problem_report',
    'problem_resolved', 'team_bonus', 'leaderboard_reward'
  ));

-- Bildirim tipine 'leaderboard_reward'.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'submission_approved', 'submission_rejected', 'badge_earned',
    'problem_status', 'reward_redeemed', 'system',
    'friend_request', 'friend_accepted', 'team_invite', 'support_reply',
    'announcement', 'community', 'stat_decay', 'leaderboard_reward'
  ));

-- ===========================================================================
-- 2. Ayarlar ve dağıtım kaydı
-- ===========================================================================

/*
  Ödül miktarları TABLODA, kodda değil: yönetici panelden değiştirebilsin
  ve her değişiklik migration gerektirmesin.

  Kapsam yalnızca 'turkiye' ve 'takimlar': il/ilçe/mahalle sıralamalarında
  ödül vermek, küçük ilçelerde üç kişilik bir listenin birincisine her
  hafta ödül vermek demekti — ödül anlamını yitirirdi.
*/
create table if not exists public.leaderboard_reward_settings (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('turkiye', 'takimlar')),
  period text not null check (period in ('week', 'month')),
  rank smallint not null check (rank between 1 and 3),
  xp integer not null default 0 check (xp >= 0),
  token integer not null default 0 check (token >= 0),
  active boolean not null default true,

  unique (scope, period, rank)
);

/*
  Dağıtım kaydı. UNIQUE(scope, period, period_key, rank) idempotentliğin
  TEK dayanağı: fonksiyon iki kez çağrılsa da ikinci çağrı bu kısıta
  takılıp hiçbir şey yazmıyor.

  period_key: 'week' için ISO yıl-hafta ('2026-W38'), 'month' için
  'YYYY-MM'. Europe/Istanbul'a göre hesaplanıyor — sunucu UTC ve hafta
  sınırı kayarsa yanlış dönem ödüllendirilirdi (aynı sınıf hata D09,
  D25 ve D29'da ölçülmüştü).
*/
create table if not exists public.leaderboard_reward_awards (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  period text not null,
  period_key text not null,
  rank smallint not null,
  user_id uuid references auth.users (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  xp integer not null,
  token integer not null,
  created_at timestamptz not null default now(),

  unique (scope, period, period_key, rank)
);

create index if not exists leaderboard_awards_user_idx
  on public.leaderboard_reward_awards (user_id, created_at desc);

alter table public.leaderboard_reward_settings enable row level security;
alter table public.leaderboard_reward_awards enable row level security;

revoke all on public.leaderboard_reward_settings from anon, authenticated;
revoke all on public.leaderboard_reward_awards from anon, authenticated;

grant select on public.leaderboard_reward_settings to anon, authenticated;
grant select on public.leaderboard_reward_awards to authenticated;

/*
  Ayarlar HERKESE okunabilir: sıralama ekranı "bu hafta ilk 3'e ne var"
  şeridini gösteriyor ve kullanıcının ödülü görmesi teşvikin kendisi.
  Yazma yalnız süper admin.
*/
drop policy if exists lrs_select_all on public.leaderboard_reward_settings;
create policy lrs_select_all on public.leaderboard_reward_settings
  for select to anon, authenticated using (true);

drop policy if exists lrs_write_super on public.leaderboard_reward_settings;
create policy lrs_write_super on public.leaderboard_reward_settings
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

grant insert, update, delete on public.leaderboard_reward_settings to authenticated;

/*
  Dağıtım kayıtları: kullanıcı KENDİ ödülünü görüyor, süper admin hepsini.
  Takım ödülünde user_id null olduğu için takım kaydını yalnız süper admin
  görüyor; üyeler kendi kişisel satırlarını görüyor.
*/
drop policy if exists lra_select on public.leaderboard_reward_awards;
create policy lra_select on public.leaderboard_reward_awards
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_super_admin());

-- Varsayılanlar.
insert into public.leaderboard_reward_settings (scope, period, rank, xp, token)
values
  -- Hafta, bireysel
  ('turkiye', 'week', 1, 500, 250),
  ('turkiye', 'week', 2, 300, 150),
  ('turkiye', 'week', 3, 150, 75),
  -- Ay, bireysel: haftanın iki katı
  ('turkiye', 'month', 1, 1000, 500),
  ('turkiye', 'month', 2, 600, 300),
  ('turkiye', 'month', 3, 300, 150),
  /*
    Takım: bölüştürme YOK, her üyeye sabit miktar veriliyor ve miktar
    bireyselin yarısı. Bölüştürme denendi ve elendi — üç kişilik takımın
    üyesi on kişilik takımın üyesinden üç kat fazla alıyordu ve bu, küçük
    takım kurmayı ödüllendiriyordu. Sabit miktar takımı büyütmeyi
    cezalandırmıyor.
  */
  ('takimlar', 'week', 1, 250, 125),
  ('takimlar', 'week', 2, 150, 75),
  ('takimlar', 'week', 3, 75, 40),
  ('takimlar', 'month', 1, 500, 250),
  ('takimlar', 'month', 2, 300, 150),
  ('takimlar', 'month', 3, 150, 80)
on conflict (scope, period, rank) do nothing;

-- ===========================================================================
-- 3. Dönem anahtarı
-- ===========================================================================

/*
  Europe/Istanbul'a göre dönem anahtarı. `p_offset` kaç dönem geriye
  gidileceğini söylüyor: 0 = içinde bulunulan dönem, 1 = biten dönem.
*/
create or replace function public.leaderboard_period_key(
  p_period text,
  p_offset integer default 0
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_period = 'month' then
      to_char(
        (now() at time zone 'Europe/Istanbul')::date
          - (p_offset || ' months')::interval,
        'YYYY-MM'
      )
    else
      to_char(
        (now() at time zone 'Europe/Istanbul')::date
          - (p_offset || ' weeks')::interval,
        'IYYY"-W"IW'
      )
  end;
$$;

grant execute on function public.leaderboard_period_key(text, integer)
  to anon, authenticated;

-- ===========================================================================
-- 4. Dağıtım
-- ===========================================================================

/*
  Dönem anahtarından zaman penceresi.

  '2026-W38' -> o ISO haftasının pazartesi 00:00'ı ile bir sonraki
  pazartesi arası; '2026-09' -> ayın ilk günü ile bir sonraki ay.
  Hepsi Europe/Istanbul.
*/
create or replace function public.leaderboard_period_range(
  p_period text,
  p_period_key text
)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select
    s at time zone 'Europe/Istanbul',
    (s + case when p_period = 'month' then interval '1 month'
              else interval '7 days' end) at time zone 'Europe/Istanbul'
  from (
    select case
      when p_period = 'month'
        then to_timestamp(p_period_key || '-01', 'YYYY-MM-DD')::timestamp
      else to_timestamp(p_period_key, 'IYYY"-W"IW')::timestamp
    end as s
  ) q;
$$;

grant execute on function public.leaderboard_period_range(text, text)
  to anon, authenticated;

/*
  Biten dönemin ilk üçüne ödül verir. IDEMPOTENT.

  İdempotentlik `leaderboard_reward_awards` üzerindeki
  UNIQUE(scope, period, period_key, rank) kısıtına yaslanıyor:
  `on conflict do nothing` ile ikinci çağrı hiçbir şey yazmıyor ve
  puanları da ikinci kez eklemiyor — puan yazımı insert BAŞARILI OLURSA
  yapılıyor.

  Denenen ve elenen: önce "bu dönem dağıtıldı mı" diye bakıp sonra
  yazmak. İki eşzamanlı çağrıda (cron + sayfa görüntüleme) ikisi de
  kontrolü geçip iki kez yazabiliyordu. Kısıt tek doğruluk kaynağı.

  KAZANANLAR leaderboard_top'tan ALINMIYOR. O fonksiyon dönem
  penceresini kendisi uyguluyor ve 'week' = İÇİNDE BULUNULAN hafta
  demek; biten haftanın ödülünü şu ankinin sıralamasıyla dağıtırdı.
  Burada pencere period_key'den türetiliyor, yani dağıtım ne zaman
  koşarsa koşsun doğru dönemi ödüllendiriyor. (Bu kusuru ilk yazımda
  yorum olarak not etmiştim; not yeterli değil, düzeltilmesi gerekiyordu.)
*/
create or replace function public.award_leaderboard_rewards(
  p_scope text,
  p_period text,
  p_period_key text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_setting public.leaderboard_reward_settings;
  v_awarded integer := 0;
  v_from timestamptz;
  v_to timestamptz;
  v_winner uuid;
  v_member record;
  v_inserted uuid;
begin
  if p_scope not in ('turkiye', 'takimlar')
     or p_period not in ('week', 'month')
     or p_period_key is null then
    return 0;
  end if;

  select r.starts_at, r.ends_at into v_from, v_to
  from public.leaderboard_period_range(p_period, p_period_key) r;

  if v_from is null then
    return 0;
  end if;

  for v_setting in
    select * from public.leaderboard_reward_settings
    where scope = p_scope and period = p_period and active
    order by rank
  loop
    v_winner := null;

    if p_scope = 'turkiye' then
      select q.user_id into v_winner
      from (
        select x.user_id, sum(x.amount) as xp
        from public.xp_transactions x
        join public.profiles p on p.id = x.user_id
        where x.created_at >= v_from and x.created_at < v_to
          and p.username is not null
          -- Ödül işlemleri sıralamayı beslemiyor: kazanan kendi
          -- ödülüyle bir sonraki dönemde de öne geçmemeli.
          and x.reason <> 'leaderboard_reward'
        group by x.user_id
        having sum(x.amount) > 0
        order by sum(x.amount) desc, x.user_id asc
        offset (v_setting.rank - 1) limit 1
      ) q;
    else
      select q.team_id into v_winner
      from (
        select tm.team_id, sum(x.amount) as xp
        from public.xp_transactions x
        join public.team_members tm on tm.user_id = x.user_id
        where x.created_at >= v_from and x.created_at < v_to
          and x.reason <> 'leaderboard_reward'
        group by tm.team_id
        having sum(x.amount) > 0
        order by sum(x.amount) desc, tm.team_id asc
        offset (v_setting.rank - 1) limit 1
      ) q;
    end if;

    if v_winner is null then
      continue;
    end if;

    insert into public.leaderboard_reward_awards
      (scope, period, period_key, rank, user_id, team_id, xp, token)
    values (
      p_scope, p_period, p_period_key, v_setting.rank,
      case when p_scope = 'turkiye' then v_winner end,
      case when p_scope = 'takimlar' then v_winner end,
      v_setting.xp, v_setting.token
    )
    on conflict (scope, period, period_key, rank) do nothing
    returning id into v_inserted;

    -- Kayıt yazılmadıysa bu dönem zaten dağıtılmış: puan da yazılmıyor.
    if v_inserted is null then
      continue;
    end if;

    if p_scope = 'turkiye' then
      if v_setting.xp > 0 then
        insert into public.xp_transactions (user_id, amount, reason)
        values (v_winner, v_setting.xp, 'leaderboard_reward');
      end if;
      if v_setting.token > 0 then
        insert into public.coin_transactions (user_id, amount, reason)
        values (v_winner, v_setting.token, 'leaderboard_reward');
      end if;

      perform public.notify(
        v_winner,
        'leaderboard_reward',
        case v_setting.rank
          when 1 then 'Zirvedesin! Sıralama ödülün hazır'
          when 2 then 'İkinci oldun! Sıralama ödülün hazır'
          else 'Üçüncü oldun! Sıralama ödülün hazır'
        end,
        format('%s dönemi %s. sırası: +%s XP +%s Token',
               p_period_key, v_setting.rank, v_setting.xp, v_setting.token)
      );
    else
      -- Her üyeye SABİT miktar (bölüştürme değil; gerekçe seed notunda).
      for v_member in
        select user_id from public.team_members where team_id = v_winner
      loop
        if v_setting.xp > 0 then
          insert into public.xp_transactions (user_id, amount, reason)
          values (v_member.user_id, v_setting.xp, 'leaderboard_reward');
        end if;
        if v_setting.token > 0 then
          insert into public.coin_transactions (user_id, amount, reason)
          values (v_member.user_id, v_setting.token, 'leaderboard_reward');
        end if;

        perform public.notify(
          v_member.user_id,
          'leaderboard_reward',
          'Takımın sıralamada ' || v_setting.rank || '. oldu!',
          format('%s dönemi: +%s XP +%s Token',
                 p_period_key, v_setting.xp, v_setting.token)
        );
      end loop;
    end if;

    v_awarded := v_awarded + 1;
  end loop;

  if v_awarded > 0 then
    perform public.log_audit(
      null, 'leaderboard.award', 'leaderboard', p_period_key,
      jsonb_build_object('scope', p_scope, 'period', p_period,
                         'awarded', v_awarded)
    );
  end if;

  return v_awarded;
end;
$$;

revoke all on function public.award_leaderboard_rewards(text, text, text)
  from public, anon, authenticated;

/*
  Tembel dağıtım kapısı.

  pg_cron yoksa (ya da çalışmadıysa) sıralama ekranı ilk açıldığında
  biten dönemleri dağıtıyor. Kullanıcı rolüne açık ama TEHLİKESİZ:
  fonksiyon yalnızca BİTEN dönemi dağıtıyor ve idempotent — bir kullanıcı
  defalarca çağırsa da ikinci çağrı hiçbir şey yazmıyor.

  Denenen ve elenen: yalnız cron'a güvenmek. pg_cron bulutta kurulu değil
  (ölçüldü: pg_available_extensions'ta var, installed_version null) ve
  kurulsa bile sessizce düşen bir job'ı fark etmek zor. Tembel yol her
  koşulda çalışan emniyet ağı.
*/
create or replace function public.settle_leaderboard_rewards()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer := 0;
begin
  v_total := v_total + public.award_leaderboard_rewards(
    'turkiye', 'week', public.leaderboard_period_key('week', 1));
  v_total := v_total + public.award_leaderboard_rewards(
    'takimlar', 'week', public.leaderboard_period_key('week', 1));
  v_total := v_total + public.award_leaderboard_rewards(
    'turkiye', 'month', public.leaderboard_period_key('month', 1));
  v_total := v_total + public.award_leaderboard_rewards(
    'takimlar', 'month', public.leaderboard_period_key('month', 1));
  return v_total;
end;
$$;

revoke all on function public.settle_leaderboard_rewards() from public, anon;
grant execute on function public.settle_leaderboard_rewards() to authenticated;

-- ===========================================================================
-- 5. Zamanlama
-- ===========================================================================

/*
  pg_cron ÖLÇÜMÜ: bulutta kullanılabilir ve kurulabiliyor
  (pg_available_extensions'ta var, `create extension` başarılı). Yerelde
  kurulu değil, bu yüzden aşağıdaki blok koşullu — yerelde sessizce
  atlanıyor ve `db reset` kırılmıyor.

  TEK BİR GÜNLÜK İŞ, iki ayrı (haftalık + aylık) iş değil.

  Sebep: settle_leaderboard_rewards idempotent ve yalnızca BİTEN dönemi
  dağıtıyor. Günlük koşmak zararsız — dönem bitmediyse hiçbir şey
  yazmıyor, bittiği gün dağıtıyor. İki ayrı zamanlama kurmak, hafta ve ay
  sınırlarını cron ifadesinde tekrar hesaplamak ve iki ayrı işin de
  çalıştığından emin olmak demekti.

  Saat 21:10 UTC = Europe/Istanbul 00:10. Dönem sınırından hemen sonra;
  kazananlar sabaha bildirimi görüyor.

  Cron ÇALIŞMASA BİLE sistem doğru işliyor: /siralama ilk açıldığında
  settle_leaderboard_rewards çağrılıyor (tembel yol). Cron gecikmeyi
  kaldırıyor, tek dayanak değil.
*/
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Aynı adlı iş varsa önce kaldır: migration yeniden koşabilmeli.
    perform cron.unschedule(jobid)
    from cron.job where jobname = 'genclig-leaderboard-settle';

    perform cron.schedule(
      'genclig-leaderboard-settle',
      '10 21 * * *',
      $cron$select public.settle_leaderboard_rewards();$cron$
    );

    raise notice 'pg_cron isi kuruldu: genclig-leaderboard-settle';
  else
    raise notice 'pg_cron kurulu degil; tembel yol (siralama ekrani) kullanilacak';
  end if;
end;
$$;
