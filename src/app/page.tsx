import Generator from "@/components/Generator";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      {/* Header */}
      <header className="no-print sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-zinc-800">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 grid place-items-center font-black text-black text-sm">KS</div>
            <div>
              <div className="font-black tracking-tight leading-none">KARTUSTOCK</div>
              <div className="text-[10px] tracking-[0.2em] text-amber-500 font-bold">WAREHOUSE FLAGSHIP • V1</div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-xs text-zinc-400">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full" /> MySQL Ready (local)
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full" /> Vercel Deployable
            </span>
            <span className="hidden lg:block">Vittoria • Warehouse DC</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/pradana93/kartustock"
              target="_blank"
              className="hidden sm:inline-flex text-xs font-bold border border-zinc-700 rounded-full px-4 py-2 hover:bg-white hover:text-black transition"
            >
              GitHub
            </a>
            <div className="hidden sm:flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-2 text-[11px]">
              <span className="w-6 h-6 rounded-full bg-white text-black grid place-items-center font-bold">VT</span>
              <span className="text-zinc-300 hidden lg:inline">wh.leader.vt@gmail.com</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="no-print relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-orange-500 to-zinc-900 opacity-10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(245,158,11,0.25),transparent_50%)]" />
        <div className="relative max-w-[1600px] mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-amber-500 text-black text-[11px] font-black tracking-widest px-3 py-1.5 rounded-full">
                ● FLAGSHIP GENERATOR — PRINT-READY STOCK CARD
              </div>
              <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.9]">
                Kartu Stock <br />
                <span className="text-amber-500">Generator</span> for Warehouse
              </h1>
              <p className="mt-4 text-zinc-400 max-w-xl text-sm sm:text-base leading-relaxed">
                Generate blank Kartu Stock / Stock Cards identical to your Google Sheets template. SKU, Pallet Code, Zone, Max Quota, Exp
                Date, QC Check — with DATE / Remark / QTY IN / QTY OUT / Stock Balance / PIC. Export to PDF for A4 printing, bulk generate
                hundreds of pallets, and save to local MySQL.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <div className="bg-white text-black rounded-2xl px-5 py-3 flex items-center gap-3">
                  <span className="text-2xl font-black">12→20</span>
                  <span className="text-xs font-bold leading-tight">
                    Blank rows
                    <br />
                    per card
                  </span>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-3 flex items-center gap-3">
                  <span className="text-2xl">🖨️</span>
                  <span className="text-xs font-bold leading-tight text-zinc-200">
                    A4 print
                    <br />
                    exact match
                  </span>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-3 flex items-center gap-3">
                  <span className="text-2xl">⚡</span>
                  <span className="text-xs font-bold leading-tight text-zinc-200">
                    Bulk & CSV
                    <br />
                    bulk print
                  </span>
                </div>
              </div>
            </div>
            <div className="relative lg:pl-8">
              <div className="bg-white rounded-[20px] p-3 shadow-2xl rotate-1 border border-zinc-200">
                <div className="bg-[#FF9D0A] rounded-t-xl py-3 text-center">
                  <div className="text-3xl font-black text-black tracking-tight">Stock Card</div>
                </div>
                <div className="grid grid-cols-2 text-[10px] text-black border-x border-b border-black">
                  <div className="p-2 border-r border-black">Pallet Code: C12-DRY-08</div>
                  <div className="p-2">Zone: Floor</div>
                  <div className="p-2 border-r border-t border-black">SKU Name: Sticker Labelling</div>
                  <div className="p-2 border-t border-black">Max Quota:</div>
                </div>
                <div className="h-24 bg-zinc-100 border-x border-b border-black grid place-items-center text-zinc-400 text-xs">Preview — identical to print</div>
              </div>
              <div className="absolute -bottom-4 -right-2 bg-amber-500 text-black text-xs font-black px-4 py-2 rounded-full shadow-xl">100% Pixel Perfect</div>
            </div>
          </div>
        </div>
      </section>

      {/* Generator */}
      <main className="flex-1 bg-[#F5F5F5] text-zinc-900 px-4 sm:px-6 py-6 sm:py-8">
        <Generator />
      </main>

      {/* Footer */}
      <footer className="no-print bg-black border-t border-zinc-900 px-4 sm:px-6 py-6">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row justify-between gap-4 text-xs text-zinc-500">
          <div>
            <div className="font-bold text-white">KARTUSTOCK • Warehouse Stock Card Generator</div>
            <div>Built for Vittoria Thingy Warehouse DC • Local MySQL + Vercel ready • No cloud DB required</div>
          </div>
          <div className="text-right">
            <div>Deploy on Vercel — set DATABASE_URL for MySQL persistence</div>
            <div>© 2026 pradana93/kartustock — flagship</div>
          </div>
        </div>
      </footer>

      <style>{`@media print { header, footer, section { display:none !important } main { background:white !important; padding:0 !important } }`}</style>
    </div>
  );
}
