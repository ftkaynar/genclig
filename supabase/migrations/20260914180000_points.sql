-- Puan ekonomisi: XP ve Coin.
--
-- Temel kural: bakiye saklanmaz, işlemlerden türetilir. Bir kullanıcının
-- toplamını değiştirmenin tek yolu yeni bir işlem satırı yazmak; böylece her
-- puanın nereden geldiği geriye dönük okunabiliyor ve yanlış bir kazanç
-- düzeltilirken geçmiş silinmiyor, ters kayıt ekleniyor.
--
-- Denenen ve elenen alternatif: profiles üzerinde total_xp / total_coin
-- sütunları tutmak. Elendi, çünkü sayaç ile gerçek arasında sessiz sapma
-- oluşabiliyor ve sapmayı fark etmenin yolu olmuyor.

-- ---------------------------------------------------------------------------
-- İşlem tabloları
-- ---------------------------------------------------------------------------

create table public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Pozitif kazanç, negatif düzeltme. XP harcanmaz; negatif yalnızca
  -- yanlış verilmiş puanı geri almak için.
  amount integer not null,
  reason text not null check (reason in ('task', 'badge', 'adjustment')),
  submission_id uuid references public.task_submissions (id) on delete set null,
  -- Elle düzeltmelerde işlemi yapan yönetici.
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  /*
    Pozitif kazanç, negatif harcama.
    reward_spend her zaman negatif amount ile yazılır; harcama akışı ayrı bir
    dilimde gelecek. Bakiyenin negatife düşmemesi o akışta, harcama yazan
    fonksiyonun içinde zorlanacak: burada bir check kısıtı tek satıra bakar,
    oysa korunması gereken şey satırların toplamı.
  */
  amount integer not null,
  reason text not null check (
    reason in ('task', 'badge', 'reward_spend', 'adjustment')
  ),
  submission_id uuid references public.task_submissions (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

/*
  İdempotansın kalbi: bir teslim en fazla bir XP ve bir Coin kaydı üretir.

  Kısmi indeks, çünkü tekillik yalnızca görev kaynaklı kayıtlar için geçerli;
  rozet ve düzeltme kayıtlarının submission_id'si yok ve aynı kullanıcıya
  defalarca yazılabilir.
*/
create unique index xp_transactions_task_submission_unique
  on public.xp_transactions (submission_id)
  where reason = 'task' and submission_id is not null;

create unique index coin_transactions_task_submission_unique
  on public.coin_transactions (submission_id)
  where reason = 'task' and submission_id is not null;

create index xp_transactions_user_id_idx on public.xp_transactions (user_id, created_at desc);
create index coin_transactions_user_id_idx on public.coin_transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Bakiye görünümleri
-- ---------------------------------------------------------------------------

/*
  security_invoker = true: görünümü sorgulayan kullanıcının yetkisiyle
  çalışsın istiyoruz, görünümü yaratanın değil.

  Varsayılan davranışta görünüm sahibinin yetkisiyle koşuyor ve altındaki
  tablonun RLS'i atlanıyordu; o haliyle herkes herkesin bakiyesini
  görebilirdi. invoker olunca xp_transactions üzerindeki politika işliyor ve
  kullanıcı yalnızca kendi toplamını, süper admin ise hepsini görüyor.
*/
create view public.user_xp_balance
with (security_invoker = true) as
  select user_id, coalesce(sum(amount), 0)::integer as total_xp
  from public.xp_transactions
  group by user_id;

create view public.user_coin_balance
with (security_invoker = true) as
  select user_id, coalesce(sum(amount), 0)::integer as total_coin
  from public.coin_transactions
  group by user_id;

-- ---------------------------------------------------------------------------
-- Seviye
-- ---------------------------------------------------------------------------

/*
  Seviye eşikleri tabloda tutuluyor, koda gömülü değil.

  Neden tablo: seviye eğrisi ürün kararı ve zamanla ayarlanacak. Formül koda
  gömülü olsaydı her ayar bir dağıtım gerektirirdi; tabloda olunca süper admin
  eşiği değiştirebiliyor ve hesap anında yeni değerle çalışıyor.

  Seed, kapalı formülle üretiliyor: min_xp(L) = 50 * L * (L - 1), yani bir
  seviyeden diğerine 100 * bulunulan seviye kadar XP. Formül yalnızca bu
  seed'i üretmek için; çalışma zamanında hiçbir yerde kullanılmıyor.

  Lv.1'in eşiği 0 olmak zorunda: level_from_xp, XP'si en düşük eşiğin bile
  altında kalan kullanıcı için dayanacak bir taban arıyor. Varsayımı yoruma
  bırakmak yerine kısıtla zorladık, çünkü eşikler elle düzenlenebilir ve
  yanlışlıkla silinen bir taban satırı hesabı sessizce bozardı.
*/
create table public.levels (
  level integer primary key check (level >= 1),
  min_xp integer not null unique check (min_xp >= 0),
  constraint levels_first_level_starts_at_zero check (level <> 1 or min_xp = 0)
);

insert into public.levels (level, min_xp)
select gs.level, (50 * gs.level * (gs.level - 1))::integer
from generate_series(1, 50) as gs(level)
on conflict do nothing;

/*
  Seviye XP'den hesaplanır, saklanmaz.

  stable, immutable değil: sonuç levels tablosundan okunuyor ve o tablo
  değişebiliyor. immutable işaretlenseydi planlayıcı sonucu önbelleğe alıp
  eşik güncellemesinden sonra bile eski değeri döndürebilirdi.

  Son seviyede next_level_xp null ve progress 1 döner; yukarısı yok.
*/
create or replace function public.level_from_xp(p_xp integer)
returns table (
  level integer,
  level_min_xp integer,
  next_level_xp integer,
  progress numeric
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_xp integer := greatest(coalesce(p_xp, 0), 0);
  v_level integer;
  v_min integer;
  v_next integer;
begin
  select l.level, l.min_xp
  into v_level, v_min
  from public.levels l
  where l.min_xp <= v_xp
  order by l.min_xp desc
  limit 1;

  -- Taban satırı bulunamazsa (levels boş ya da Lv.1 eşiği bozulmuş) kullanıcı
  -- seviyesiz kalmasın diye en düşük seviyeye düşülüyor.
  if v_level is null then
    v_level := 1;
    v_min := 0;
  end if;

  select l.min_xp into v_next
  from public.levels l
  where l.level = v_level + 1;

  return query select
    v_level,
    v_min,
    v_next,
    case
      when v_next is null or v_next <= v_min then 1::numeric
      else round((v_xp - v_min)::numeric / (v_next - v_min), 4)
    end;
end;
$$;

grant execute on function public.level_from_xp(integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Görev ödülü yazımı
-- ---------------------------------------------------------------------------

/*
  Onaylanmış bir teslimin ödülünü yazar.

  İdempotent: ON CONFLICT DO NOTHING ile kısmi tekil indekse yaslanıyor.
  Aynı teslim için ikinci çağrı hiçbir şey yazmıyor, hata da vermiyor —
  çağıran taraf (şu an submit_task, ileride panel onayı) tekrar tetiklenirse
  puan katlanmasın diye.

  security definer: işlem tablolarına yazma hakkı hiçbir client rolünde yok.
  Politika ve GRANT seviyesinde kapalı; yazan tek yer bu fonksiyon.

  Onaylanmamış teslimde sessizce çıkıyor. Hata fırlatmak, çağıran akışı
  (konum doğrulaması başarılı ama ödül yazılamadı gibi) gereksiz yere
  kırardı; puan yazılmaması zaten doğru davranış.
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

  -- Sıfır ödüllü görevde kayıt açılmıyor; bakiyeye etkisi olmayan satır
  -- işlem geçmişini gereksiz şişirir.
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
end;
$$;

revoke all on function public.award_task_points(uuid) from public;
revoke all on function public.award_task_points(uuid) from anon;
grant execute on function public.award_task_points(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- submit_task: otomatik onaylanan teslimlerde ödülü yaz
-- ---------------------------------------------------------------------------

/*
  D08'deki gövdenin aynısı; tek fark sondaki ödül çağrısı.

  Ödül yalnızca approved açılan teslimlerde yazılıyor. pending teslimler
  (fotoğraflı görevler) insan incelemesi bekliyor; onay panelden geldiğinde
  award_task_points o akıştan çağrılacak. Bağlantı noktası burası değil,
  inceleme akışı — bu yüzden burada yalnızca otomatik onay yolu var.
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
-- RLS
-- ---------------------------------------------------------------------------

alter table public.levels enable row level security;
alter table public.xp_transactions enable row level security;
alter table public.coin_transactions enable row level security;

-- Seviye eşikleri gizli bilgi değil: kullanıcı bir sonraki seviyeye ne kadar
-- kaldığını görebilmeli, giriş yapmamış ziyaretçi de eğriyi görebilir.
create policy levels_select_public on public.levels
  for select to anon, authenticated using (true);

create policy levels_insert_super on public.levels
  for insert to authenticated with check (public.is_super_admin());
create policy levels_update_super on public.levels
  for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy levels_delete_super on public.levels
  for delete to authenticated using (public.is_super_admin());

create policy xp_transactions_select_own on public.xp_transactions
  for select to authenticated using (user_id = (select auth.uid()));

create policy xp_transactions_select_super on public.xp_transactions
  for select to authenticated using (public.is_super_admin());

create policy coin_transactions_select_own on public.coin_transactions
  for select to authenticated using (user_id = (select auth.uid()));

create policy coin_transactions_select_super on public.coin_transactions
  for select to authenticated using (public.is_super_admin());

/*
  INSERT, UPDATE ve DELETE politikası bilerek yok ve yazma GRANT'i de
  verilmiyor. Puan yazmanın tek yolu security definer fonksiyonlar; iki
  katman birden kapalı olsun diye hem politika hem yetki seviyesinde
  engelleniyor.

  Belediye personelinin analitik amaçlı okuması bu dilimde bilerek eklenmedi;
  kapsam kullanıcı ve süper adminle sınırlı tutuldu.
*/

/*
  Önce her şey geri alınıyor, sonra yalnızca gereken veriliyor.

  Neden revoke şart: Supabase public şemada oluşturulan tablolara anon ve
  authenticated rollerine INSERT, UPDATE, DELETE dahil tüm yetkileri
  kendiliğinden veriyor. Ölçüldü: yalnızca politika yazıp yetkiye
  dokunmadığımızda authenticated rolünün xp_transactions üzerinde INSERT
  yetkisi görünüyordu ve yazmayı durduran tek şey politikanın yokluğuydu.
  Tek katman yeterli değil; politika ileride yanlışlıkla genişletilirse
  yetki de açık olduğu için yazma yolu tamamen açılırdı.
*/
revoke all on public.levels from anon, authenticated;
grant select on public.levels to anon, authenticated;
-- Yazma yetkisi authenticated'de duruyor ama politikalar süper adminle
-- sınırlıyor; iki koşul birden sağlanmadan satır değişmiyor.
grant insert, update, delete on public.levels to authenticated;

revoke all on public.xp_transactions from anon, authenticated;
revoke all on public.coin_transactions from anon, authenticated;
grant select on public.xp_transactions to authenticated;
grant select on public.coin_transactions to authenticated;

revoke all on public.user_xp_balance from anon, authenticated;
revoke all on public.user_coin_balance from anon, authenticated;
grant select on public.user_xp_balance to authenticated;
grant select on public.user_coin_balance to authenticated;
