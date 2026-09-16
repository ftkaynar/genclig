-- M29a: Bildirim düzeltmeleri + web push abonelikleri.

-- ===========================================================================
-- 1. KRİTİK: hesap silme yine kırıktı
-- ===========================================================================

/*
  ÖLÇÜLEN HATA (D30 FAZ N): kullanıcı KENDİ hesabını silince

    insert or update on table "audit_logs" violates foreign key
    constraint "audit_logs_actor_id_fkey"

  Zincir: hesap silinir -> user_roles satırları cascade ile silinir ->
  M28'de eklediğim audit_role tetikleyicisi çalışır -> log_audit
  actor_id = auth.uid() ile yazmaya çalışır -> o kullanıcı auth.users'tan
  çoktan gitmiştir -> FK ihlali -> SİLME İŞLEMİ KOMPLE GERİ ALINIR.

  Bu, D26'da recompute_user_stats'ta ölçülen hatanın BİREBİR aynısı.
  Orada koruma fonksiyonun içine konmuştu; aynı dersi burada tekrar
  uygulamadım ve M28 ile hatayı geri getirdim. Ölçüm:

    postgres rolüyle silme            -> BASARILI  (auth.uid() null)
    kendi JWT'siyle kendini silme     -> KIRIK

  İlk test yanıltıcıydı çünkü auth.uid() null dönüyordu; gerçek akışta
  kullanıcının kendi claim'i var.

  Koruma log_audit'in İÇİNDE: her çağıranı birden kapsıyor ve ileride
  eklenecek tetikleyiciler de korunmuş oluyor. Kayıt yine düşüyor,
  yalnızca aktör null oluyor — silinmiş bir kullanıcıyı işaret etmenin
  zaten anlamı yok.
*/
create or replace function public.log_audit(
  p_actor uuid,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := p_actor;
begin
  if v_actor is not null
     and not exists (select 1 from auth.users where id = v_actor) then
    v_actor := null;
  end if;

  insert into public.audit_logs (actor_id, action, target_type, target_id, meta)
  values (v_actor, p_action, p_target_type, p_target_id,
          coalesce(p_meta, '{}'::jsonb));
end;
$$;

revoke all on function public.log_audit(uuid, text, text, text, jsonb)
  from public, anon, authenticated;

-- ===========================================================================
-- 2. Destek: kendi yanıtına kendine bildirim gitmesin
-- ===========================================================================

/*
  ÖLÇÜLEN HATA (D30 FAZ N): kullanıcı kendi destek talebine kendi yanıt
  verince bildirim sayacı artıyordu.

    kendi yanıtı: bildirim öncesi=0 sonrası=1 (fark=1)

  Sebep: koşul yalnızca "yanıtlayan personel mi" diye bakıyordu
  (`if v_staff then notify(v_ticket.user_id, ...)`). Proje sahibi hem
  süper admin hem de talebin sahibi olduğu için kendi kendine bildirim
  gönderiyordu. Bu, tek kullanıcılı kurulumda garip değil KURAL: personel
  kendi açtığı bir talebe yanıt yazabilir.

  Düzeltme: alıcı ile gönderen aynıysa bildirim yok. Bildirim her zaman
  KARŞI TARAFA gider.
*/
create or replace function public.reply_ticket(p_ticket uuid, p_body text)
returns public.ticket_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ticket public.support_tickets;
  v_staff boolean := public.is_super_admin();
  v_row public.ticket_messages;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  if p_body is null or length(trim(p_body)) < 2 then
    raise exception 'Mesaj boş olamaz.';
  end if;

  select * into v_ticket from public.support_tickets where id = p_ticket;

  if v_ticket.id is null then
    raise exception 'Talep bulunamadı.';
  end if;

  if not v_staff and v_ticket.user_id <> v_uid then
    raise exception 'Bu talebe yanıt verme yetkin yok.';
  end if;

  if v_ticket.status = 'closed' then
    raise exception 'Bu talep kapatılmış.';
  end if;

  insert into public.ticket_messages (ticket_id, sender_id, body, is_staff)
  values (p_ticket, v_uid, trim(p_body), v_staff)
  returning * into v_row;

  update public.support_tickets
  set status = case when v_staff then 'answered' else 'open' end,
      updated_at = now()
  where id = p_ticket;

  -- Bildirim yalnızca KARŞI TARAFA.
  if v_staff and v_ticket.user_id <> v_uid then
    perform public.notify(
      v_ticket.user_id,
      'support_reply',
      'Destek talebine yanıt geldi',
      v_ticket.subject,
      v_ticket.id
    );
  end if;

  return v_row;
end;
$$;

revoke all on function public.reply_ticket(uuid, text) from public, anon;
grant execute on function public.reply_ticket(uuid, text) to authenticated;

-- ===========================================================================
-- 3. Web push abonelikleri
-- ===========================================================================

/*
  Bir kullanıcının birden çok aboneliği olabiliyor (telefon + masaüstü),
  bu yüzden birincil anahtar endpoint değil ama endpoint TEKİL: aynı
  tarayıcı aynı endpoint'i üretiyor ve mükerrer kayıt aynı bildirimi iki
  kez göndermek demek olurdu.

  p256dh ve auth tarayıcının ürettiği şifreleme anahtarları; sunucu
  bunlar olmadan yük şifreleyemiyor. Gizli sayılmıyorlar (zaten yalnız o
  endpoint için geçerliler) ama RLS ile yine de kendi satırlarıyla
  sınırlı.
*/
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

/*
  Kendi aboneliğini yazar, okur, siler.

  Sunucu tarafı gönderim service_role ile çalışıyor ve RLS'i atlıyor;
  bu yüzden "herkesin aboneliğini oku" diye bir politika YOK. Push
  gönderimi ayrıcalıklı bir iş, kullanıcı başkasının endpoint'ini
  görmemeli.
*/
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ===========================================================================
-- 4. Bildirim okundu: toplu işaretleme yardımcısı
-- ===========================================================================

/*
  Sayfa açılınca okundu işaretlemek için. Zaten mark_all_read benzeri bir
  akış vardı ama sunucu eyleminden çağrılıyordu; burada tek bir definer
  fonksiyon var ki hem sayfa açılışı hem düğme aynı yolu kullansın.

  Yalnızca ÇAĞIRANIN kendi bildirimlerini işaretliyor.
*/
create or replace function public.mark_my_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
begin
  if v_uid is null then
    return 0;
  end if;

  with done as (
    update public.notifications
    set is_read = true
    where user_id = v_uid and is_read = false
    returning id
  )
  select count(*) into v_count from done;

  return v_count;
end;
$$;

revoke all on function public.mark_my_notifications_read() from public, anon;
grant execute on function public.mark_my_notifications_read() to authenticated;
