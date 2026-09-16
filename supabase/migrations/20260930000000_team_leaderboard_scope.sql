-- M33 (D34 FAZ ST): takım sıralamasına coğrafi kapsam.

/*
  ÖLÇÜLEN SORUN: sıralama ekranında Bireysel sekmesi dört kapsamda
  (Türkiye/İl/İlçe/Mahalle) ve üç dönemde çalışıyordu; Takım sekmesinde
  ise kapsam çipleri HİÇ GÖSTERİLMİYORDU çünkü leaderboard_teams yalnız
  dönem alıyordu. Aynı ekranın iki sekmesi iki ayrı derinlikte
  değerlendiriliyordu — takımlar "tam vatandaş" değildi.

  TAKIMIN KAPSAMI = KAPTANIN PROFİL KONUMU.

  Denenen ve elenen alternatif: üyelerin çoğunluk konumu. Doğru sonuç
  veriyor ama her satırda üyeler üzerinden bir mod hesabı gerektiriyor
  ve beraberlikte (iki ilden ikişer üye) keyfi bir seçim yapmak
  zorunda kalıyordu. Kaptanın konumu tek satırlık, belirsizliği yok ve
  kullanıcıya açıklanabilir: takımı kuran kişi takımın yerini belirler.

  Kaptanın konumu eksikse takım YALNIZ Türkiye kapsamında görünüyor —
  daraltılmış bir kapsamda konumsuz takımı göstermek, o ilin
  sıralamasını kirletirdi.

  Yeni tablo YOK: yalnız bu fonksiyon değişiyor.
*/
create or replace function public.leaderboard_teams(
  p_period text default 'week',
  p_scope text default 'turkiye'
)
returns table (
  rank integer,
  team_id uuid,
  team_name text,
  icon text,
  member_count integer,
  total_xp integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_since timestamptz;
  v_province smallint;
  v_district bigint;
  v_neighborhood bigint;
begin
  if p_period not in ('week', 'month', 'year', 'all') then
    raise exception 'Geçersiz dönem.';
  end if;

  /*
    Kapsam listesi leaderboard_top ile AYNI — 'arkadaslar' hariç.
    Arkadaş kapsamı takımda anlamsız: takım zaten bir grup.
  */
  if p_scope not in ('turkiye', 'il', 'ilce', 'mahalle') then
    raise exception 'Geçersiz kapsam.';
  end if;

  v_since := public.period_start(p_period);

  -- Çağıranın konumu: "benim ilimdeki takımlar" bu satıra dayanıyor.
  select p.province_id, p.district_id, p.neighborhood_id
  into v_province, v_district, v_neighborhood
  from public.profiles p where p.id = v_uid;

  return query
  with scoped as (
    select t.id, t.name, t.icon
    from public.teams t
    join public.profiles cap on cap.id = t.captain_id
    where
      p_scope = 'turkiye'
      or (p_scope = 'il' and v_province is not null
          and cap.province_id = v_province)
      or (p_scope = 'ilce' and v_district is not null
          and cap.district_id = v_district)
      or (p_scope = 'mahalle' and v_neighborhood is not null
          and cap.neighborhood_id = v_neighborhood)
  ),
  totals as (
    select
      s.id,
      s.name,
      s.icon,
      (select count(*)::integer from public.team_members m where m.team_id = s.id)
        as members,
      coalesce(sum(x.amount), 0)::integer as xp
    from scoped s
    left join public.team_members tm on tm.team_id = s.id
    left join public.xp_transactions x
      on x.user_id = tm.user_id and x.created_at >= v_since
    group by s.id, s.name, s.icon
  )
  select
    row_number() over (order by q.xp desc, q.name asc)::integer,
    q.id,
    q.name::text,
    q.icon,
    q.members,
    q.xp
  from totals q
  where q.xp > 0
  order by q.xp desc, q.name asc
  limit 50;
end;
$$;

revoke all on function public.leaderboard_teams(text, text) from public, anon;
grant execute on function public.leaderboard_teams(text, text) to authenticated;

/*
  Tek parametreli ESKİ imza kaldırılıyor.

  Bırakılsaydı PostgREST iki aday arasında kalırdı ve `{p_period: ...}`
  çağrısı "could not choose the best candidate function" hatası
  verirdi (aynı sınıf belirsizlik M26'da ölçülmüştü). Yeni imzanın
  p_scope varsayılanı 'turkiye' olduğu için eski davranış korunuyor.
*/
drop function if exists public.leaderboard_teams(text);
