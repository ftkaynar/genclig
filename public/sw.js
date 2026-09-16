/*
  GençLİG service worker — yalnızca push bildirimi.

  Bilerek ÖNBELLEK YOK. Çevrimdışı önbellek eklemek, sunucuda render
  edilen sayfaların bayat sürümlerini göstermeye ve "neden eski veri
  görüyorum" sınıfı hatalara kapı açıyordu; push için gereken tek şey
  aşağıdaki iki olay.

  Kayıt istemciden yapılıyor (lib/push/client.ts). Dosya public/ altında
  çünkü service worker yalnızca kendi kapsamındaki (scope) sayfaları
  yönetebiliyor ve kök kapsam için kökten servis edilmesi gerekiyor.
*/

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // Gövde JSON değilse düz metin olarak kullanılıyor; bildirimi
    // tamamen düşürmektense başlıksız göstermek yeğdir.
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "GençLİG";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-32.png",
    // Aynı etiketli bildirim üst üste yığılmıyor, sonuncusu öncekini
    // değiştiriyor: on görev onayı on ayrı bildirim olarak birikmemeli.
    tag: payload.tag || "genclig",
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      /*
        Uygulama zaten açıksa YENİ SEKME AÇMIYORUZ: her bildirim yeni bir
        sekme açsaydı kullanıcı birkaç bildirimden sonra onlarca sekmeyle
        kalırdı. Açık pencere varsa ona odaklanıp oraya yönlendiriyoruz.
      */
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(url);
          }
          return;
        }
      }

      await self.clients.openWindow(url);
    })(),
  );
});
