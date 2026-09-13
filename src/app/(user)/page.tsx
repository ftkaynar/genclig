// Kullanıcı PWA ana ekranı. Route group "(user)" URL'e yansımaz, "/" olarak servis edilir.
// Neden route group: /panel ve /admin'den ayrı bir layout'a geçebilmek için; şimdilik placeholder.
export default function UserHomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-3 px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">GençLİG</h1>
      <p className="text-center text-sm text-neutral-600">
        Şehrinde görev yap, puan kazan.
      </p>
    </main>
  );
}
