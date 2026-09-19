-- M34a (D35 FAZ K): görev kurumu ve konum etiketi.

/*
  Görevi KİM açtı ve NEREDE yapılıyor?

  ÖNCEKİ DURUM: görevin sahibi yalnız `municipality_id` ile anlaşılıyordu
  ve arayüzde hiç gösterilmiyordu. Bir STK'nın, okulun ya da platformun
  kendi açtığı görev ile bir belediyenin görevi kullanıcı için aynı
  görünüyordu — "bunu kim istiyor" sorusunun cevabı yoktu.

  issuer_name SERBEST METİN, tabloya referans değil: görevi açan taraf
  çoğu zaman sistemde kaydı olmayan bir kurum (mahalle derneği, okul
  kulübü). Onları `organizations` gibi bir tabloya bağlamak, görev
  açmadan önce kurum kaydı yaratmayı zorunlu kılardı ve panelde iş akışını
  ikiye bölerdi. İhtiyaç büyürse tablo sonradan gelir; kolon o zaman
  referansa çevrilir.

  location_label KISA metin, koordinat DEĞİL: lat/lng zaten var ve GPS
  doğrulaması onu kullanıyor. Bu alan insanın okuduğu yer tanımı
  ("Gülhane Parkı, Fatih") — koordinattan üretilemez ve üretilse bile
  ters geocoding'e bağımlı olurdu.
*/
alter table public.tasks
  add column if not exists issuer_name text;

alter table public.tasks
  add column if not exists location_label text;

comment on column public.tasks.issuer_name is
  'Görevi açan kurum (STK/okul vb.). Boşsa belediye adı, o da boşsa GençLİG gösterilir.';

comment on column public.tasks.location_label is
  'İnsanın okuduğu kısa yer tanımı ("Gülhane Parkı, Fatih"). Koordinat değil.';

/*
  Uzunluk sınırı: kart üzerinde tek satırda gösteriliyor.

  60/80 karakter, 160px genişliğinde bir kutucukta iki satıra taşmadan
  sığan üst sınıra göre seçildi. Sınırsız bırakmak, panelden yapıştırılan
  bir paragrafın kart düzenini bozması demekti.
*/
alter table public.tasks
  drop constraint if exists tasks_issuer_name_len;
alter table public.tasks
  add constraint tasks_issuer_name_len
  check (issuer_name is null or length(issuer_name) between 2 and 60);

alter table public.tasks
  drop constraint if exists tasks_location_label_len;
alter table public.tasks
  add constraint tasks_location_label_len
  check (location_label is null or length(location_label) between 2 and 80);
