-- M35b (D36 FAZ HR): sıra anlık görüntüleri + trend yönü.

/*
  NEDEN.

  Ana sayfadaki "Sıralaman" kartı üç sayı gösteriyor (Türkiye / İl /
  İlçe) ama sayı tek başına yön taşımıyor: kullanıcı #412 görüyor ve
  bunun iyiye mi kötüye mi gittiğini bilmiyor. Oyunlaştırmada asıl
  motive eden şey konum değil HAREKET.

  Trend için bir önceki sıranın saklanması gerekiyor.

  localStorage denendi ve elendi: cihaz değiştiren ya da tarayıcı
  verisini temizleyen kullanıcı trendini kaybediyor, ayrıca istemcide
  tutulan bir "önceki sıra" kullanıcı tarafından değiştirilebiliyor —
  puan ekonomisine dokunmayan bir gösterge olsa da yanlış bilgi
  göstermenin bedeli var. Sunucu tarafı anlık görüntü hem cihazdan
  bağımsız hem güvenilir.

  GÜNDE BİR SATIR. Birincil anahtar (user_id, scope, day) kapı görevi
  görüyor: aynı gün içinde sayfa kaç kez açılırsa açılsın ilk yazım
  kalıyor. Böylece "önceki" her zaman ÖNCEKİ BİR GÜNÜN sırası oluyor,
  beş dakika önceki değil — gün içindeki dalgalanma ok göstermiyor.

  Ayrı bir cron'a bağlamak denendi ve elendi: cron her kullanıcı için
  sıra hesaplamak zorunda kalırdı (kullanıcı sayısıyla doğrusal bir iş),
  oysa trend yalnızca ekranı AÇAN kullanıcı için gerekiyor. Okuma anında
  yazmak hem ucuz hem kendi kendine ölçekleniyor.
*/

create table if not exists public.rank_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Ana sayfadaki üç sütun. 'takimlar' yok: o kart takım sırası değil.
  scope text not null check (scope in ('turkiye', 'il', 'ilce')),
  -- Europe/Istanbul takvim günü; gün sınırı istanbul_day() ile aynı.
  day date not null,
  rank integer not null check (rank >= 1),
  captured_at timestamptz not null default now(),
  primary key (user_id, scope, day)
);

comment on table public.rank_snapshots is
  'Kullanıcının günlük sıra anlık görüntüsü; ana sayfadaki trend okunu besliyor.';

alter table public.rank_snapshots enable row level security;

/*
  Kullanıcı yalnız kendi satırını OKUYOR. Yazma politikası YOK: satırlar
  yalnızca aşağıdaki security definer fonksiyonla yazılıyor. İstemciye
  yazma açmak, kullanıcının kendi trendini uydurabilmesi demekti.
*/
create policy "rank_snapshots_select_own"
  on public.rank_snapshots for select to authenticated
  using (user_id = (select auth.uid()));

/*
  Üç kapsamın güncel sırası + bir önceki günün sırası + yön.

  OUT parametreleri `t_` önekli. Gerekçe: D32 FAZ KE'de RETURNS TABLE
  içindeki `id` adı gövdedeki tablo sütunuyla çakışmış ve sorgu
  belirsiz kalmıştı; `scope` ve `rank` burada aynı tuzağın tam
  ortasında (ikisi de rank_snapshots sütunu).
*/
create or replace function public.rank_trends()
returns table (
  t_scope text,
  t_rank integer,
  t_prev integer,
  t_dir text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := public.istanbul_day();
  v_scope text;
  v_rank integer;
  v_prev integer;
begin
  if v_uid is null then
    return;
  end if;

  foreach v_scope in array array['turkiye', 'il', 'ilce'] loop
    v_rank := null;
    v_prev := null;

    /*
      Sıra, kartın gösterdiğiyle AYNI kaynaktan: leaderboard_my_rank,
      haftalık dönem. Burada ayrı bir sorgu yazmak, iki yerde iki farklı
      sıra hesabı demekti (aynı sınıf hata D24 ve D30'da ölçüldü).
    */
    select r.rank into v_rank
    from public.leaderboard_my_rank(v_scope, 'week') r;

    -- Karşılaştırma yalnız ÖNCEKİ GÜNLERLE: gün içi dalgalanma ok üretmiyor.
    select s.rank into v_prev
    from public.rank_snapshots s
    where s.user_id = v_uid
      and s.scope = v_scope
      and s.day < v_today
    order by s.day desc
    limit 1;

    -- Sırası olmayan kullanıcı için anlık görüntü yazılmıyor: "sırada
    -- değilsin" bir sıra değil, 0 yazmak da sonraki gün sahte bir
    -- düşüş üretirdi.
    if v_rank is not null then
      insert into public.rank_snapshots (user_id, scope, day, rank)
      values (v_uid, v_scope, v_today, v_rank)
      on conflict (user_id, scope, day) do nothing;
    end if;

    t_scope := v_scope;
    t_rank := v_rank;
    t_prev := v_prev;
    t_dir := case
      when v_rank is null or v_prev is null then 'none'
      -- KÜÇÜK sıra daha iyi: 12 -> 5 yükseliştir.
      when v_rank < v_prev then 'up'
      when v_rank > v_prev then 'down'
      else 'same'
    end;

    return next;
  end loop;
end;
$$;

revoke all on function public.rank_trends() from public, anon;
grant execute on function public.rank_trends() to authenticated;
