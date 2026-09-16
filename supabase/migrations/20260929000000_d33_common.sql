-- D33 ortak: yeni işlem gerekçeleri ve bildirim tipleri.

/*
  DİLİM 33'ün dört özelliği de puan yazıyor ve bildirim üretiyor.
  Kısıtlar tek yerden genişletiliyor: aynı check'i dört migration'da
  drop+recreate etmek, birinin ötekini geri alması demekti (M20'de
  tam bu olmuştu).

  IDEMPOTENS DESENİ — bu dilimin değişmez kuralı:

  Yeni bonusların hiçbiri transaction tablosuna kolon EKLEMİYOR. Her
  bonusun kendi "kapı tablosu" var (chain_awards, referral_awards) ve
  akış şöyle:

      insert into <kapı> (...) values (...) on conflict do nothing;
      if found then  -- satır GERÇEKTEN girdiyse
        <transaction yaz>
      end if;

  Neden kolon değil kapı tablosu: xp_transactions'a her bonus için bir
  kolon + kısmi tekil indeks eklemek tabloyu her özellikte genişletiyor
  ve eski satırlarda null bırakıyordu. Kapı tablosu, "bu ödül bu
  kullanıcıya verildi mi" sorusunu tek satırda ve birincil anahtarla
  cevaplıyor; iki eşzamanlı tetik yarışsa bile yalnız biri geçiyor.
*/

-- ===========================================================================
-- 1. İşlem gerekçeleri
-- ===========================================================================

alter table public.xp_transactions
  drop constraint if exists xp_transactions_reason_check;

alter table public.xp_transactions
  add constraint xp_transactions_reason_check check (
    reason in (
      'task',
      'badge',
      'adjustment',
      'problem_report',
      'problem_resolved',
      'team_bonus',
      'leaderboard_reward',
      -- D33: görev zinciri tamamlama bonusu
      'chain_bonus',
      -- D33: davet ödülü (hem davet edene hem edilene)
      'referral'
    )
  );

alter table public.coin_transactions
  drop constraint if exists coin_transactions_reason_check;

alter table public.coin_transactions
  add constraint coin_transactions_reason_check check (
    reason in (
      'task',
      'badge',
      'reward_spend',
      'adjustment',
      'problem_report',
      'problem_resolved',
      'team_bonus',
      'leaderboard_reward',
      'chain_bonus',
      'referral'
    )
  );

-- ===========================================================================
-- 2. Bildirim tipleri
-- ===========================================================================

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'submission_approved',
      'submission_rejected',
      'badge_earned',
      'problem_status',
      'reward_redeemed',
      'system',
      'friend_request',
      'friend_accepted',
      'team_invite',
      'support_reply',
      'announcement',
      'community',
      'stat_decay',
      'leaderboard_reward',
      -- D33
      'chain_completed',
      'referral_reward'
    )
  );

-- ===========================================================================
-- 3. Ortak yardımcı: takvim günü (Europe/Istanbul)
-- ===========================================================================

/*
  Günün Görevi TAKVİM gününe bağlı (00:00), sürekli görev ritmindeki
  06:00 penceresine değil.

  Neden farklı: 06:00 penceresi kişisel bir alışkanlık ritmi. Günün
  Görevi ise herkes için AYNI anda değişmeli ve "bugün" dendiğinde
  takvimdeki gün anlaşılmalı — 2x ödülün hangi güne ait olduğu
  tartışmaya açık olmamalı.
*/
create or replace function public.istanbul_day(p_at timestamptz default now())
returns date
language sql
immutable
set search_path = ''
as $$
  select (p_at at time zone 'Europe/Istanbul')::date;
$$;

comment on function public.istanbul_day(timestamptz) is
  'Verilen anın Europe/Istanbul takvim günü.';

revoke all on function public.istanbul_day(timestamptz) from public, anon;
grant execute on function public.istanbul_day(timestamptz) to authenticated;
