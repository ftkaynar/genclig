-- M32d (D33 FAZ SZ): Sezonlar — dönemsel tema ve katılım rozeti.

-- ===========================================================================
-- 1. Tablo
-- ===========================================================================

create table if not exists public.seasons (
  id smallint primary key generated always as identity,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  /*
    theme: v2 palet aksan anahtarı ('violet', 'gold', 'cyan', ...).

    Renk KODU değil ANAHTAR saklanıyor: palet değişirse tek yerden
    (lib/ui/accents.ts) çözülüyor ve DB'deki satırlara dokunmak
    gerekmiyor. Aynı karar D32'de tasks.art_key için de verilmişti.
  */
  theme text not null default 'violet',
  status text not null default 'upcoming'
    check (status in ('upcoming', 'active', 'ended')),
  /*
    Rozet dağıtımı BİR KEZ. Kapı burada bir bayrak, ayrı bir tablo
    değil: dağıtım sezon başına tek bir olay ve user_badges zaten
    kullanıcı başına kapıyı tutuyor (birincil anahtar user_id+badge_id).
    İkinci bir kapı tablosu aynı garantiyi tekrarlardı.
  */
  badge_awarded boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists seasons_status_idx on public.seasons (status, starts_at);

alter table public.seasons enable row level security;

drop policy if exists seasons_select on public.seasons;
create policy seasons_select on public.seasons
  for select to authenticated using (true);

drop policy if exists seasons_write on public.seasons;
create policy seasons_write on public.seasons
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ===========================================================================
-- 2. Seed: içinde bulunulan çeyrek
-- ===========================================================================

/*
  "Sezon 1" — içinde bulunulan takvim çeyreği (Europe/Istanbul).

  Çeyrek seçildi: ay çok kısa (rozet biriktirmeye vakit kalmıyor), yıl
  çok uzun (sezon hissi kayboluyor). Üç ay, okul döneminin de doğal
  uzunluğu.

  Seed idempotent: aynı adla ikinci sezon açmıyor.
*/
do $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  if exists (select 1 from public.seasons) then
    raise notice 'sezon zaten var, seed atlandi';
    return;
  end if;

  v_start := date_trunc('quarter', now() at time zone 'Europe/Istanbul')
               at time zone 'Europe/Istanbul';
  v_end := (date_trunc('quarter', now() at time zone 'Europe/Istanbul')
              + interval '3 months') at time zone 'Europe/Istanbul';

  insert into public.seasons (name, starts_at, ends_at, theme, status)
  values ('Sezon 1', v_start, v_end, 'violet', 'active');

  raise notice 'Sezon 1 olusturuldu: % - %', v_start, v_end;
end;
$$;

-- ===========================================================================
-- 3. Okuma
-- ===========================================================================

/*
  Şu an aktif sezon.

  status yerine TARİHE bakılıyor: status alanı yöneticinin elle
  ayarladığı bir etiket ve unutulabiliyor. Tarih aralığı tek doğru
  kaynak; status yalnızca yönetim listesinde sıralama/filtre için.

  Aynı anda iki sezon aktif olursa (yönetici hatası) en yenisi
  kazanıyor — boş dönmek, kartın ve sıralamanın sezonsuz kalması
  demekti.
*/
create or replace function public.active_season()
returns table (
  id smallint,
  name text,
  theme text,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.theme, s.starts_at, s.ends_at
  from public.seasons s
  where s.starts_at <= now() and s.ends_at > now()
  order by s.starts_at desc
  limit 1;
$$;

revoke all on function public.active_season() from public, anon;
grant execute on function public.active_season() to authenticated;

-- ===========================================================================
-- 4. Sezon sonu rozeti
-- ===========================================================================

/*
  Biten sezonların katılım rozetini dağıtır.

  Ölçüt: sezon aralığında EN AZ BİR onaylı teslim. Eşik bilerek düşük —
  bu bir başarı rozeti değil KATILIM rozeti; "o sezonda buradaydım"
  diyor. Yüksek eşik denendi ve elendi: sezon rozeti az kişide olursa
  koleksiyon hissi oluşmuyor ve geri gelme sebebi olmuyor.

  Rozet satırı yoksa OLUŞTURULUYOR (slug 'sezon-N'). criteria tipi
  'season': check_and_award_badges bu tipi tanımıyor ve atlıyor, yani
  rozet yalnız buradan dağıtılıyor. Görev tamamlayan biri sezon
  rozetini kazara almıyor.

  Kapı: user_badges birincil anahtarı (user_id, badge_id) + sezonun
  badge_awarded bayrağı. İkisi birden: bayrak işi tekrar çalıştırmayı
  ucuzlatıyor, birincil anahtar ise bayrak yanlışlıkla sıfırlansa bile
  ikinci rozeti engelliyor.
*/
create or replace function public.settle_season_badges()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season record;
  v_badge uuid;
  v_slug text;
  v_user record;
  v_total integer := 0;
begin
  for v_season in
    select * from public.seasons
    where ends_at <= now() and badge_awarded = false
    order by starts_at
  loop
    v_slug := 'sezon-' || v_season.id;

    select id into v_badge from public.badges where slug = v_slug;

    if v_badge is null then
      insert into public.badges
        (slug, name, description, icon, criteria, xp_bonus, coin_bonus, status)
      values (
        v_slug,
        v_season.name,
        v_season.name || ' boyunca en az bir görev tamamladın.',
        'trophy',
        jsonb_build_object('type', 'season', 'season_id', v_season.id),
        0,
        0,
        'active'
      )
      returning id into v_badge;
    end if;

    for v_user in
      select distinct s.user_id
      from public.task_submissions s
      where s.status = 'approved'
        and s.created_at >= v_season.starts_at
        and s.created_at < v_season.ends_at
    loop
      insert into public.user_badges (user_id, badge_id)
      values (v_user.user_id, v_badge)
      on conflict do nothing;

      -- Bildirim yalnız GERÇEKTEN yeni rozet kazanana.
      if found then
        perform public.notify(
          v_user.user_id,
          'badge_earned',
          v_season.name || ' rozetini kazandın',
          v_season.name || ' boyunca görev yaptın. Rozet profilinde.',
          v_badge
        );
        v_total := v_total + 1;
      end if;
    end loop;

    update public.seasons
    set badge_awarded = true, status = 'ended'
    where id = v_season.id;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.settle_season_badges() from public, anon;
grant execute on function public.settle_season_badges() to authenticated;

-- ===========================================================================
-- 5. Günlük iş
-- ===========================================================================

/*
  Sezon bitişini günde bir kontrol ediyor (Istanbul 00:20).

  Vitrin seçiminden (00:05) sonra: ikisi aynı dakikada koşup aynı
  tabloları kilitlemesin.

  Cron çalışmasa bile sistem doğru işliyor: /siralama sezon başlığını
  okurken de çağrılabiliyor (tembel yol) — ama rozet dağıtımı pahalı
  bir iş, bu yüzden tembel yol YALNIZ sezon bitmişse tetikleniyor.
*/
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job where jobname = 'genclig-season-settle';

    perform cron.schedule(
      'genclig-season-settle',
      '20 21 * * *',
      $cron$select public.settle_season_badges();$cron$
    );

    raise notice 'pg_cron isi kuruldu: genclig-season-settle';
  else
    raise notice 'pg_cron kurulu degil; tembel yol kullanilacak';
  end if;
end;
$$;
