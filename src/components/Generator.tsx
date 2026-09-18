"use client";
import { useState, useRef, useEffect } from "react";
import { StockCard } from "./StockCard";
import { StockCardData, defaultCard } from "@/lib/types";
import { QRCodeSVG } from "qrcode.react";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function Generator() {
  const [cards, setCards] = useState<StockCardData[]>([{ ...defaultCard, id: uid() }]);
  const [activeId, setActiveId] = useState<string>(cards[0].id);
  const [bulkInput, setBulkInput] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const activeCard = cards.find((c) => c.id === activeId) || cards[0];

  function updateActive(patch: Partial<StockCardData>) {
    setCards((prev) => prev.map((c) => (c.id === activeId ? { ...c, ...patch } : c)));
  }

  function addCard() {
    const c = { ...defaultCard, id: uid(), palletCode: "", skuName: "", zone: "" };
    setCards((p) => [...p, c]);
    setActiveId(c.id);
  }

  function duplicateCard() {
    const c = { ...activeCard, id: uid() };
    setCards((p) => [...p, c]);
    setActiveId(c.id);
  }

  function removeCard(id: string) {
    if (cards.length === 1) return;
    const next = cards.filter((c) => c.id !== id);
    setCards(next);
    if (id === activeId) setActiveId(next[0].id);
  }

  function handleBulkGenerate() {
    const lines = bulkInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!lines.length) return;
    const newCards: StockCardData[] = lines.map((code) => ({
      ...activeCard,
      id: uid(),
      palletCode: code,
    }));
    setCards((p) => [...p, ...newCards]);
    setBulkInput("");
    setShowBulk(false);
  }

  function handlePrint() {
    window.print();
  }

  async function handleDownloadPDF() {
    // Use browser print to PDF - faithful to screenshot
    window.print();
  }

  function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const rows = text.split("\n").slice(1); // skip header if present
      const parsed: StockCardData[] = [];
      rows.forEach((line) => {
        const [pallet, zone, sku, maxQ, exp, qc] = line.split(",").map((s) => s?.trim());
        if (!pallet) return;
        parsed.push({
          id: uid(),
          palletCode: pallet,
          zone: zone || activeCard.zone,
          skuName: sku || activeCard.skuName,
          maxQuota: maxQ || "",
          expDate: exp || "",
          qcCheck: qc || "",
          rows: activeCard.rows,
          paperSize: "A4",
          orientation: "portrait",
        });
      });
      if (parsed.length) setCards((p) => [...p, ...parsed]);
    };
    reader.readAsText(file);
  }

  // persist to localStorage (acts as local DB fallback) + try mysql via API if available
  useEffect(() => {
    const saved = localStorage.getItem("kartustock:cards");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) {
          setCards(parsed);
          setActiveId(parsed[0].id);
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("kartustock:cards", JSON.stringify(cards));
    // optional sync to MySQL - fire and forget, won't break if no DB
    fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cards),
    }).catch(() => {});
  }, [cards]);

  return (
    <div className="w-full max-w-[1600px] mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 items-start">
        {/* LEFT PANEL - FORM */}
        <div className="no-print sticky top-6 space-y-4">
          {/* Card Tabs */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                Kartu Stock ({cards.length})
              </h3>
              <div className="flex gap-1.5">
                <button onClick={addCard} className="text-[11px] bg-white text-black px-3 py-1.5 rounded-full font-bold hover:bg-amber-400 transition">
                  + New
                </button>
                <button onClick={duplicateCard} className="text-[11px] bg-zinc-800 text-white px-3 py-1.5 rounded-full font-semibold border border-zinc-700 hover:bg-zinc-700">
                  Duplicate
                </button>
              </div>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {cards.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap border flex items-center gap-2 shrink-0 transition ${
                    c.id === activeId
                      ? "bg-amber-500 text-black border-amber-500"
                      : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                  }`}
                >
                  {c.palletCode || "Untitled"}
                  {cards.length > 1 && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCard(c.id);
                      }}
                      className="w-4 h-4 rounded-full bg-black/20 grid place-items-center text-[10px] hover:bg-red-500 hover:text-white"
                    >
                      ×
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={() => setShowBulk(!showBulk)}
                className="col-span-2 text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black py-2.5 rounded-xl hover:opacity-90"
              >
                ⚡ Bulk Generate from Pallet Codes
              </button>
              <label className="text-xs bg-zinc-800 text-zinc-200 border border-zinc-700 py-2.5 rounded-xl text-center font-semibold cursor-pointer hover:bg-zinc-700">
                📄 Import CSV
                <input type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
              </label>
              <button
                onClick={() => {
                  const blob = new Blob(
                    [
                      "palletCode,zone,skuName,maxQuota,expDate,qcCheck\n" +
                        cards.map((c) => `${c.palletCode},${c.zone},${c.skuName},${c.maxQuota},${c.expDate},${c.qcCheck}`).join("\n"),
                    ],
                    { type: "text/csv" }
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `kartu-stock-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                }}
                className="text-xs bg-zinc-800 text-zinc-200 border border-zinc-700 py-2.5 rounded-xl font-semibold hover:bg-zinc-700"
              >
                ⬇ Export CSV
              </button>
            </div>

            {showBulk && (
              <div className="mt-3 bg-zinc-800 rounded-xl p-3 border border-zinc-700">
                <p className="text-[11px] text-zinc-400 mb-2">Paste pallet codes, one per line or comma separated. They will inherit current SKU/Zone.</p>
                <textarea
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder={"C12-DRY-08\nC12-DRY-09\nC13-FROZEN-01"}
                  className="w-full h-28 bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={handleBulkGenerate}
                  disabled={!bulkInput.trim()}
                  className="mt-2 w-full bg-amber-500 text-black font-bold text-sm py-2 rounded-lg disabled:opacity-40"
                >
                  Generate {bulkInput.split(/[\n,]+/).filter(Boolean).length || 0} Cards
                </button>
              </div>
            )}
          </div>

          {/* FORM FIELDS */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4 shadow-xl">
            <h3 className="font-black text-zinc-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-amber-500 grid place-items-center text-black">◉</span>
              Card Details
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-black tracking-widest text-zinc-500 uppercase">SKU Name *</label>
                <input
                  value={activeCard.skuName}
                  onChange={(e) => updateActive({ skuName: e.target.value })}
                  placeholder="e.g. Sticker Labelling"
                  className="mt-1 w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-3 text-sm font-semibold focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black tracking-widest text-zinc-500 uppercase">Pallet Code</label>
                  <input
                    value={activeCard.palletCode}
                    onChange={(e) => updateActive({ palletCode: e.target.value.toUpperCase() })}
                    placeholder="C12-DRY-08"
                    className="mt-1 w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-3 text-sm font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black tracking-widest text-zinc-500 uppercase">Zone / Area</label>
                  <input
                    value={activeCard.zone}
                    onChange={(e) => updateActive({ zone: e.target.value })}
                    placeholder="Floor"
                    className="mt-1 w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-3 text-sm font-semibold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black tracking-widest text-zinc-500 uppercase">Max Qty / Max Quota</label>
                  <input
                    value={activeCard.maxQuota}
                    onChange={(e) => updateActive({ maxQuota: e.target.value })}
                    placeholder="e.g. 500 Ctn"
                    className="mt-1 w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black tracking-widest text-zinc-500 uppercase">QC Check</label>
                  <select
                    value={activeCard.qcCheck}
                    onChange={(e) => updateActive({ qcCheck: e.target.value })}
                    className="mt-1 w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="">— Select —</option>
                    <option value="✓ PASS">✓ PASS</option>
                    <option value="✗ FAIL">✗ FAIL</option>
                    <option value="⧗ PENDING">⧗ PENDING</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black tracking-widest text-zinc-500 uppercase">Exp Date</label>
                <input
                  type="date"
                  value={activeCard.expDate}
                  onChange={(e) => updateActive({ expDate: e.target.value })}
                  className="mt-1 w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-black tracking-widest text-zinc-500 uppercase">Blank Rows: {activeCard.rows}</label>
                <input
                  type="range"
                  min={8}
                  max={20}
                  value={activeCard.rows}
                  onChange={(e) => updateActive({ rows: Number(e.target.value) })}
                  className="w-full accent-amber-500 mt-2"
                />
                <div className="flex justify-between text-[10px] text-zinc-400">
                  <span>8 rows</span>
                  <span>20 rows</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <div className="bg-zinc-900 rounded-xl p-2">
                  <QRCodeSVG value={activeCard.palletCode || "KARTU-STOCK"} size={64} />
                </div>
                <div className="text-[11px] leading-tight text-zinc-600">
                  <div className="font-bold text-zinc-900">QR for Pallet</div>
                  <div>Scan to identify pallet</div>
                  <div className="font-mono font-bold mt-1">{activeCard.palletCode || "—"}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={handlePrint} className="bg-zinc-900 text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-black">
                🖨️ Print
              </button>
              <button onClick={handleDownloadPDF} className="bg-amber-500 text-black font-black py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-amber-400">
                ⬇ PDF
              </button>
              <button
                onClick={() => setCards([{ ...defaultCard, id: uid() }])}
                className="col-span-2 text-xs text-zinc-500 font-semibold py-2 hover:text-red-600"
              >
                Reset all (clear local storage)
              </button>
            </div>

            <p className="text-[10px] text-zinc-400 text-center leading-tight">
              MySQL optional — data saved locally. For warehouse server, set <code className="bg-zinc-100 px-1 rounded">DATABASE_URL</code> to MySQL.
            </p>
          </div>
        </div>

        {/* RIGHT PANEL - PREVIEW */}
        <div className="space-y-4">
          <div className="no-print flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-zinc-900 rounded-2xl px-5 py-4 border border-zinc-800">
            <div>
              <h2 className="text-white font-black flex items-center gap-2">
                <span className="w-2 h-8 bg-amber-500 rounded-full" />
                Live Preview • A4 Print Ready
              </h2>
              <p className="text-xs text-zinc-400 mt-1">Exactly as will be printed — orange header, bordered table, blank entries.</p>
            </div>
            <div className="flex gap-2">
              <span className="text-[10px] font-bold tracking-widest bg-amber-500 text-black px-3 py-1.5 rounded-full">300 DPI</span>
              <span className="text-[10px] font-bold tracking-widest bg-white text-black px-3 py-1.5 rounded-full">{cards.length} CARD{cards.length > 1 ? "S" : ""}</span>
            </div>
          </div>

          {/* Single Active Preview - flagship */}
          <div ref={previewRef} className="bg-[#EEF0F2] p-4 sm:p-8 rounded-[24px] border border-zinc-200 shadow-inner">
            <StockCard data={activeCard} />
            <div className="no-print mt-4 flex justify-center gap-2 text-[10px] text-zinc-500">
              <span>◀ Use tabs on left to edit each card</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">Print shows only the card (no UI)</span>
            </div>
          </div>

          {/* All cards for bulk print - hidden on screen pagination but shown for print */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-4 no-print">
            <h3 className="text-xs font-black tracking-widest text-zinc-500 uppercase mb-3">Bulk Print Queue — prints each card on its own page</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[520px] overflow-auto p-1">
              {cards.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`cursor-pointer rounded-xl overflow-hidden border-2 transition ${c.id === activeId ? "border-amber-500 shadow-lg" : "border-zinc-200 hover:border-zinc-300"}`}
                >
                  <div className="scale-[0.55] origin-top-left w-[180%] h-[220px] -mb-[140px] pointer-events-none">
                    <StockCard data={c} showQR={false} />
                  </div>
                  <div className="bg-zinc-900 text-white text-[11px] font-bold px-3 py-2 flex justify-between">
                    <span>{c.palletCode || "No code"}</span>
                    <span className="text-zinc-400 truncate ml-2">{c.skuName}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Print-only bulk */}
          <div className="hidden print:block space-y-8">
            {cards.map((c) => (
              <div key={c.id} className="break-after-page print-break-inside-avoid">
                <StockCard data={c} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
