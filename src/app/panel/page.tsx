import { AppHeader } from "@/components/app-header";

// Belediye paneli placeholder. Varsayılan tema açık (bkz. defaultThemeFor).
export default function PanelPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <AppHeader title="GençLİG Belediye Paneli" />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <section className="rounded-2xl border border-edge bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold tracking-tight text-ink">
            Belediye Paneli
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Görev ve başvuru yönetimi burada olacak.
          </p>
        </section>
      </main>
    </div>
  );
}
