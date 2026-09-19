-- M35a (D36 FAZ TK): konum doğrulamalı görevlere eksik konum bilgisini doldur.

/*
  NEDEN.

  Keşfet haritası ve "Yakınındaki görevler" şeridi koordinata bağlı.
  Ölçüm (yerel, migration öncesi):

    konum doğrulamalı görev (gps + photo_gps)   17
    koordinatı olmayan                          10
    konum etiketi olmayan                        9
    yarıçapı olmayan                            10

  Yani konum doğrulaması isteyen her üç görevden ikisinde doğrulanacak
  bir konum YOKTU. Bu görevler haritada hiç görünmüyor, yakındakiler
  şeridine hiç giremiyor ve teslim anında GPS kontrolü yapılacak bir
  hedefleri yok. Kullanıcı açısından "Konumum" düğmesine basıp hiçbir
  şeyin değişmemesinin sebeplerinden biri buydu (D36 FAZ D1).

  KAPSAM: yalnızca `gps` ve `photo_gps`. Quiz ya da düz fotoğraf
  görevlerine de yer adı yazmak denendi ve elendi — "Bilgi yarışmasını
  Gülhane Parkı'nda çöz" diye bir şey yok, konum oraya bilgi değil
  gürültü katardı.

  ETİKET VE KOORDİNAT BİRLİKTE YAZILIYOR, ayrı ayrı değil. İlk sürüm
  her alanı bağımsız `coalesce` ile dolduruyordu ve koordinatı ZATEN
  OLAN ama etiketi olmayan görevlere listeden bir ad yazıyordu; ölçümde
  "Fethi Paşa Korusu, Üsküdar" etiketi 40.9865/29.0254 (Kadıköy)
  koordinatının üstüne biniyordu. Koordinatıyla çelişen bir etiket,
  etiketsizlikten daha kötü: kullanıcı yanlış yere gidiyor. Artık
  yalnızca İKİSİ DE boş olan satırlar dolduruluyor; koordinatı olup
  etiketi olmayan satırlar etiketsiz bırakılıyor (harita zaten
  çalışıyor, ters geocoding yapacak bir servisimiz yok).

  KOORDİNATLAR YAKLAŞIK. Aşağıdaki yerler gerçek ve herkese açık
  İstanbul mekânları ama koordinatlar mekânın genel merkezini gösteren
  yaklaşık değerler, ölçülmüş giriş noktaları değil. Yarıçap 150 m
  bunu tolere edecek şekilde seçildi. Belediye personeli panelden
  düzeltebiliyor; bu backfill bir başlangıç değeri, son söz değil.

  İDEMPOTENS: hedef koşulu `lat is null and lng is null`. İlk koşudan
  sonra o satırlar dolduğu için ikinci koşuda hedef kümesi boş kalıyor.
  `location_label` ve `radius_m` yine de `coalesce` ile yazılıyor —
  koordinatı boş ama etiketi elle girilmiş bir satırın etiketi
  ezilmemeli.
*/

do $$
declare
  v_oncesi integer;
  v_sonrasi integer;
begin
  select count(*) into v_oncesi
  from public.tasks
  where verification in ('gps', 'photo_gps')
    and lat is null and lng is null;

  /*
    Hedef kimlikler ÖNCE sabitleniyor (CTE), sonra tek UPDATE.

    Denenen ve elenen alternatif: her alan için ayrı UPDATE + alt sorgu.
    D35 FAZ K'de tam olarak bunu yapmış ve satırların birbirini ezdiğini
    ölçmüştük — alt sorgu değişen tabloyu yeniden okuduğu için
    row_number offset'i her adımda kayıyordu.
  */
  with yer(sira, label, lat, lng) as (
    values
      ( 1, 'Gülhane Parkı, Fatih',              41.0135, 28.9800),
      ( 2, 'Maçka Demokrasi Parkı, Şişli',      41.0450, 28.9940),
      ( 3, 'Yıldız Parkı, Beşiktaş',            41.0500, 29.0130),
      ( 4, 'Fethi Paşa Korusu, Üsküdar',        41.0270, 29.0330),
      ( 5, 'Emirgan Korusu, Sarıyer',           41.1080, 29.0550),
      ( 6, 'Özgürlük Parkı, Kadıköy',           40.9880, 29.0330),
      ( 7, 'Göztepe 60. Yıl Parkı, Kadıköy',    40.9740, 29.0620),
      ( 8, 'Botanik Parkı, Bakırköy',           40.9800, 28.8700),
      ( 9, 'Florya Sahili, Bakırköy',           40.9740, 28.7880),
      (10, 'Caddebostan Sahili, Kadıköy',       40.9640, 29.0620),
      (11, 'Moda Sahili, Kadıköy',              40.9810, 29.0250),
      (12, 'Sultanahmet Meydanı, Fatih',        41.0055, 28.9770),
      (13, 'Beyazıt Devlet Kütüphanesi, Fatih', 41.0105, 28.9650),
      (14, 'Atatürk Kitaplığı, Beyoğlu',        41.0370, 28.9880),
      (15, 'Rami Kütüphanesi, Eyüpsultan',      41.0590, 28.9330),
      (16, 'Nevmekan Sahil, Üsküdar',           41.0250, 29.0150),
      (17, 'Validebağ Korusu, Üsküdar',         41.0000, 29.0500),
      (18, 'Belgrad Ormanı, Sarıyer',           41.1830, 28.9800),
      (19, 'Ataköy Sahili, Bakırköy',           40.9780, 28.8420),
      (20, 'Kocasinan Parkı, Bahçelievler',     41.0000, 28.8560)
  ),
  hedef as (
    select
      t.id,
      row_number() over (order by t.created_at, t.id) as n
    from public.tasks t
    where t.verification in ('gps', 'photo_gps')
      and t.lat is null and t.lng is null
  )
  update public.tasks t
  set
    location_label = coalesce(t.location_label, y.label),
    lat = y.lat,
    lng = y.lng,
    -- 150 m: yaklaşık koordinatın hata payını ve park büyüklüğünü kapsıyor.
    radius_m = coalesce(t.radius_m, 150)
  from hedef h
  join yer y
    on y.sira = ((h.n - 1) % 20) + 1
  where t.id = h.id;

  select count(*) into v_sonrasi
  from public.tasks
  where verification in ('gps', 'photo_gps')
    and lat is null and lng is null;

  raise notice 'konum backfill: oncesi % koordinatsiz, sonrasi % koordinatsiz, doldurulan %',
    v_oncesi, v_sonrasi, v_oncesi - v_sonrasi;
end;
$$;
