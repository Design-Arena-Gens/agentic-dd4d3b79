import ImageEditor from "@/components/ImageEditor";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-400/80">
              LumaCraft Studio
            </p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
              AI Image Editing Suite for Creatives & Web Teams
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
              Craft production-ready visuals, export transparent assets, and generate instant design inspiration without leaving the browser.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-cyan-200">
              Browser-native AI workflow
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-12">
        <ImageEditor />
      </main>
      <footer className="border-t border-white/10 bg-black/30">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} LumaCraft Studio. Built for Vercel deployments.</p>
          <p className="text-slate-500">
            Tips: Upload PNG, JPG, or WebP up to 8MB. AI tools run locally — no assets leave your browser.
          </p>
        </div>
      </footer>
    </div>
  );
}
