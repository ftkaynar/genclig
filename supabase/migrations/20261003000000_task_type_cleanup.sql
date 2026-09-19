-- M36a (D38 FAZ K): uygulanmamış görev tiplerini temizle.

/*
  NEDEN.

  Keşfet'te "Fatih (3)" yazıyordu ama veritabanında Fatih'te 4 aktif
  görev vardı. Sayaç ile liste tutarlıydı (yedi ilçenin yedisinde de
  sayaç = kart sayısı = harita pini); tutarsız olan VERİTABANI ile
  ARAYÜZDÜ.

  Kök sebep: `tasks.type` beş değer kabul ediyor —

    continuous, instant, daily, weekly, monthly

  ama uygulama yalnız ikisini tanıyor. `FEED_TASK_TYPES` sabiti
  ("continuous", "instant") bütün feed sorgularının içinde; geri kalan
  üç tip hiçbir listeye, haritaya ya da sayaca girmiyor. Kodun başka
  hiçbir yerinde de karşılıkları yok — grep'te yalnız panel formunun
  açılır listesinde geçiyorlar.

  Yani personel "Günlük" seçtiğinde görev kaydediliyor, `active`
  oluyor, veritabanında duruyor ve UYGULAMADA HİÇ GÖRÜNMÜYOR. Bulutta
  bir, yerelde dört böyle görev vardı.

  YAPILAN: bu tipler `continuous`'a çevriliyor.

  Neden continuous: "günlük görev" zaten sürekli görevin ta kendisi —
  sürekli görevler görev günü penceresinde (Europe/Istanbul 06:00)
  tekrarlanabiliyor ve `daily_submission_limit` sütunu günlük sınırı
  ayrıca tutuyor. Yani `daily` tipinin yapması beklenen şeyi
  `continuous` zaten yapıyor.

  Denenen ve elenen alternatif: üç tipi FEED_TASK_TYPES'a eklemek.
  Elendi çünkü kadans mantığı HİÇ YAZILMAMIŞ — `taskCardState` tekrar
  davranışını yalnız `continuous`'a veriyor, haftalık/aylık ritmi
  hesaplayan bir kod yok. Görünür yapmak, ritmi tutulmayan görevleri
  "tek seferlik" gibi davranırken listeye sokmak olurdu: görünmezden
  daha kötü, çünkü sessizce yanlış çalışırdı.

  CHECK kısıtı da daraltılıyor. Form artık yalnız iki tip sunuyor ama
  kısıt veri katmanında da aynı şeyi söylemeli — aksi halde bir sonraki
  toplu içe aktarma ya da elle güncelleme aynı boşluğu geri getirir.
  İleride haftalık/aylık gerçekten uygulanırsa kısıtı genişletmek tek
  satır.
*/

do $$
declare
  v_cevrilen integer;
begin
  update public.tasks
  set type = 'continuous'
  where type in ('daily', 'weekly', 'monthly');

  get diagnostics v_cevrilen = row_count;
  raise notice 'uygulanmamis tip continuous''a cevrildi: % gorev', v_cevrilen;
end;
$$;

alter table public.tasks
  drop constraint if exists tasks_type_check;

alter table public.tasks
  add constraint tasks_type_check
  check (type in ('continuous', 'instant'));

comment on column public.tasks.type is
  'Yalnız uygulanmış iki tip: continuous (tekrarlanabilir) ve instant '
  '(tarihli, tek seferlik). Yeni bir tip eklemeden önce feed sorguları '
  've kart durum mantığı da yazılmalı (M36a).';
