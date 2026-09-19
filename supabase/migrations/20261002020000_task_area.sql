-- M35c (D36 FAZ KF): göreve il/ilçe alanı + etiketlerden geri doldurma.

/*
  NEDEN.

  Keşfet'e konum filtresi isteniyordu ("il/ilçe seçici, harita ve
  şeritler seçilen bölgeye göre"). Ölçüm, bunun bugünkü şemayla
  KURULAMAYACAĞINI gösterdi:

    tasks.municipality_id dolu olan görev        0
    provinces tablosunda koordinat sütunu        yok (yalnız id, name)
    districts tablosunda koordinat sütunu        yok (id, province_id, name)
    tasks üzerinde il/ilçe alanı                 yok

  Yani görevi bir bölgeye bağlayan hiçbir yol yoktu. Filtre yazılsaydı
  her seçim boş liste döndürürdü — filtresizlikten kötü.

  DENENEN VE ELENEN ALTERNATİFLER:

  1. municipality_id üzerinden gitmek. Elendi: sıfır görevde dolu, üstelik
     belediye "hangi kurum açtı" sorusunu yanıtlıyor, "nerede yapılıyor"
     sorusunu değil. Dernek görevinin belediyesi yok ama konumu var.

  2. location_label metnini sorgu anında ilçe adıyla eşlemek. Elendi:
     serbest metin. "Fatih" ilçe adı ama "Fatih Sultan Mehmet Köprüsü"
     de eşleşirdi; ilçe adı geçmeyen etiket ise hiç eşleşmezdi. Sorgu
     anında yapılan tahmin, veriye yazılan gerçekten daha kırılgan.

  3. İl merkezlerini (81 satır koordinat) eklemek ve göreve en yakın ili
     atamak. Elendi: İstanbul'un iki yakası arasındaki mesafe, bazı
     komşu il merkezleri arasındaki mesafeden büyük. Koordinat
     yakınlığı idari sınırın yerine geçmiyor.

  SEÇİLEN: görevin kendi il/ilçe alanı. Bölge bilgisi tahmin edilen değil
  YAZILAN bir veri oluyor; panel personeli düzeltebiliyor ve sorgu
  tarafında belirsizlik kalmıyor.
*/

alter table public.tasks
  add column if not exists province_id smallint references public.provinces(id),
  add column if not exists district_id bigint references public.districts(id);

comment on column public.tasks.province_id is
  'Görevin yapıldığı il. Keşfet konum filtresi bunu kullanıyor (M35c).';
comment on column public.tasks.district_id is
  'Görevin yapıldığı ilçe; province_id ile tutarlı olmalı.';

/*
  Filtre sorgusu bu iki sütun üzerinden gidiyor ve görev sayısı
  büyüdükçe tarama pahalılaşır. Kısmi indeks: bölgesi olmayan satırlar
  indekse hiç girmiyor.
*/
create index if not exists tasks_area_idx
  on public.tasks (province_id, district_id)
  where province_id is not null;

/*
  GERİ DOLDURMA — KOORDİNATTAN, ETİKETTEN DEĞİL.

  İlk sürüm `location_label` metninin virgülden sonraki parçasını ilçe
  adıyla eşliyordu. Ölçüm: 16 koordinatlı görevden yalnız 3'ü eşleşti.
  Sebep M35a'nın kendi kuralı — etiket `coalesce` ile yazılmıştı, yani
  zaten "Halk kütüphanesi", "Muhtarlık" gibi genel bir etiketi olan
  görevler o etiketi korudu ve o etiketlerde ilçe adı geçmiyor.

  Koordinat ise HEPSİNDE M35a'nın yer listesinden geldi ve o listenin
  her satırı hangi ilçede olduğunu biliyor. Aynı koordinat çiftini
  burada tekrar listeleyip ilçeyi oradan okumak, metin tahmininden
  farklı olarak KESİN.

  Koordinatlar M35a ile birebir aynı olmak zorunda; biri değişirse
  diğeri de değişmeli. İkisini tek yerde tutmak için ayrı bir "yerler"
  tablosu açmak denendi ve elendi: tek seferlik bir geri doldurma için
  kalıcı bir referans tablosu, bakımı olan ama kullanılmayan bir yapı
  bırakırdı.
*/
do $$
declare
  v_il smallint;
  v_yazilan integer;
begin
  select id into v_il from public.provinces where name = 'İstanbul';

  if v_il is null then
    raise notice 'Istanbul bulunamadi; geri doldurma atlandi';
    return;
  end if;

  with yer(lat, lng, ilce) as (
    values
      (41.0135, 28.9800, 'Fatih'),
      (41.0450, 28.9940, 'Şişli'),
      (41.0500, 29.0130, 'Beşiktaş'),
      (41.0270, 29.0330, 'Üsküdar'),
      (41.1080, 29.0550, 'Sarıyer'),
      (40.9880, 29.0330, 'Kadıköy'),
      (40.9740, 29.0620, 'Kadıköy'),
      (40.9800, 28.8700, 'Bakırköy'),
      (40.9740, 28.7880, 'Bakırköy'),
      (40.9640, 29.0620, 'Kadıköy'),
      (40.9810, 29.0250, 'Kadıköy'),
      (41.0055, 28.9770, 'Fatih'),
      (41.0105, 28.9650, 'Fatih'),
      (41.0370, 28.9880, 'Beyoğlu'),
      (41.0590, 28.9330, 'Eyüpsultan'),
      (41.0250, 29.0150, 'Üsküdar'),
      (41.0000, 29.0500, 'Üsküdar'),
      (41.1830, 28.9800, 'Sarıyer'),
      (40.9780, 28.8420, 'Bakırköy'),
      (41.0000, 28.8560, 'Bahçelievler'),
      /*
        Aşağıdaki iki çift M35a'dan DEĞİL, ilk görev tohumundan geliyor.
        M35a yalnız koordinatı boş olanları doldurduğu için bu altı
        görev listeye hiç uğramadı ve ilk ölçümde bölgesiz kaldı.
        41.0134/28.9812 Gülhane-Sirkeci hattı (Fatih), 40.9865/29.0254
        Moda-Kadıköy hattı.
      */
      (41.0134, 28.9812, 'Fatih'),
      (40.9865, 29.0254, 'Kadıköy')
  ),
  hedef as (
    select t.id, d.id as district_id
    from public.tasks t
    join yer y
      -- Yuvarlama payı: sütunlar double precision, tam eşitlik kırılgan.
      on abs(t.lat - y.lat) < 0.00005
     and abs(t.lng - y.lng) < 0.00005
    join public.districts d
      on d.province_id = v_il and d.name = y.ilce
    where t.province_id is null
  )
  update public.tasks t
  set province_id = v_il,
      district_id = h.district_id
  from hedef h
  where t.id = h.id;

  get diagnostics v_yazilan = row_count;
  raise notice 'gorev bolgesi geri dolduruldu: % satir', v_yazilan;
end;
$$;
