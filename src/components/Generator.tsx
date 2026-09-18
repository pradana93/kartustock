"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { StockCard } from "./StockCard";
import { StockCardData, defaultCard } from "@/lib/types";
import { QRCodeSVG } from "qrcode.react";
import { parseMasterCSV, PalletMasterRow } from "@/lib/sheet";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function masterToCard(row: PalletMasterRow, base: StockCardData): StockCardData {
  const zoneParts = [row.zoneType, row.levelRack].filter(Boolean).join(" • ");
  const zone = zoneParts || row.zoneType || row.gudang || "";
  const sku = row.currentSku && row.currentSku !== "None" && row.currentSku !== "-" ? row.currentSku : "";
  const maxQuota = row.maxCapacity && row.maxCapacity !== "-" ? row.maxCapacity : "";
  return {
    id: uid(),
    palletCode: row.palletCode,
    zone: zone + (row.gudang ? ` (${row.gudang})` : ""),
    skuName: sku,
    maxQuota,
    expDate: row.expDate && row.expDate !== "-" ? row.expDate : "",
    qcCheck: "",
    rows: base.rows,
    paperSize: "A4",
    orientation: "portrait",
  };
}

export default function Generator() {
  // Queue starts empty - no pending dummy (user requested)
  const [cards, setCards] = useState<StockCardData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bulkInput, setBulkInput] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  // Draft template for Card Details when queue empty (fixes cannot-edit)
  const [draft, setDraft] = useState<StockCardData>({ ...defaultCard, id: "draft" });

  // Master sheet state
  const [sheetUrl, setSheetUrl] = useState("");
  const [masterRows, setMasterRows] = useState<PalletMasterRow[]>([]);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [sheetError, setSheetError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterGudang, setFilterGudang] = useState("All");
  const [filterZone, setFilterZone] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showMaster, setShowMaster] = useState(true);
  const [masterSource, setMasterSource] = useState<string>("");
  // Bulk Print A4 state
  const [printLayout, setPrintLayout] = useState<"1" | "2">("1");
  const [ephemeralPrint, setEphemeralPrint] = useState<StockCardData[] | null>(null);

  const hasCards = cards.length > 0;
  const activeCard = hasCards ? (cards.find((c) => c.id === activeId) || cards[0]) : draft;

  function updateActive(patch: Partial<StockCardData>) {
    if (hasCards && activeId) {
      setCards((prev) => prev.map((c) => (c.id === activeId ? { ...c, ...patch } : c)));
    } else {
      setDraft((prev) => ({ ...prev, ...patch }));
    }
  }

  function addCard() {
    // push current draft as a new card then reset draft
    const base = hasCards ? activeCard : draft;
    const c: StockCardData = { ...base, id: uid() };
    setCards((p) => [...p, c]);
    setActiveId(c.id);
  }

  function duplicateCard() {
    if (!hasCards && !draft) return;
    const c = { ...activeCard, id: uid() };
    setCards((p) => [...p, c]);
    setActiveId(c.id);
  }

  function removeCard(id: string) {
    const next = cards.filter((c) => c.id !== id);
    setCards(next);
    if (id === activeId) setActiveId(next.length ? next[0].id : null);
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
    // Print the currently edited card (draft if queue empty, otherwise active card)
    triggerPrint([activeCard], printLayout);
  }

  async function handleDownloadPDF() {
    triggerPrint([activeCard], printLayout);
  }

  function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      // try master parser first, if it yields pallet rows with gudang, use that path
      const parsedMaster = parseMasterCSV(text);
      if (parsedMaster.length > 2) {
        setMasterRows(parsedMaster);
        setMasterSource(`CSV: ${file.name}`);
        setSheetError("");
        setSelected(new Set());
        setShowMaster(true);
        return;
      }
      const rows = text.split("\n").slice(1);
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

  async function loadFromSheet() {
    if (!sheetUrl.trim()) {
      setSheetError("Paste your Google Sheets URL first (e.g. https://docs.google.com/spreadsheets/d/.../edit#gid=...)");
      return;
    }
    setLoadingSheet(true);
    setSheetError("");
    try {
      const res = await fetch("/api/sheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: sheetUrl }) });
      const data = await res.json();
      if (!res.ok) throw new Error([data.error, data.hint].filter(Boolean).join(" — ") || "Failed to load");
      const csv: string = data.csv;
      const parsed = parseMasterCSV(csv);
      if (!parsed.length) {
        const preview = csv.slice(0, 400).replace(/\n/g, " | ");
        throw new Error(`No pallet rows found in fetched tab (gid=${data.gid ?? "default"}). Open the 'Pallet Code' tab specifically and copy its URL (should contain gid=1688169041), or use Upload CSV. Preview: ${preview}…`);
      }
      setMasterRows(parsed);
      setMasterSource(`Google Sheet (${parsed.length} pallets${data.gid ? ` · gid=${data.gid}` : ""})`);
      setSelected(new Set());
      if (data.gid && !sheetUrl.includes("gid=")) {
        // auto-fix URL to include correct gid for next time
        const sep = sheetUrl.includes("?") ? "&" : "?";
        const fixed = sheetUrl.replace(/#.*$/, "") + `${sep}gid=${data.gid}`;
        setSheetUrl(fixed);
      }
    } catch (err: unknown) {
      setSheetError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingSheet(false);
    }
  }

  function handleMasterCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const t = String(r.result || "");
      const p = parseMasterCSV(t);
      if (!p.length) { setSheetError("No pallets found in CSV. Export the 'Pallet Code' tab as CSV and try again."); return; }
      setMasterRows(p);
      setMasterSource(`CSV: ${f.name} (${p.length})`);
      setSheetError("");
      setSelected(new Set());
    };
    r.readAsText(f);
  }

  // Per-column filters (table-level)
  const [filterLevel, setFilterLevel] = useState("All");
  const [colPallet, setColPallet] = useState("");
  const [colSku, setColSku] = useState("");
  const [sortCol, setSortCol] = useState<null | "pallet" | "gudang" | "zone" | "level" | "sku" | "status">(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filteredMaster = useMemo(() => {
    let out = masterRows.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        if (!`${r.palletCode} ${r.currentSku} ${r.zoneType} ${r.levelRack} ${r.gudang}`.toLowerCase().includes(q)) return false;
      }
      if (filterGudang !== "All" && r.gudang !== filterGudang) return false;
      if (filterZone !== "All" && r.zoneType !== filterZone) return false;
      if (filterStatus !== "All" && r.status !== filterStatus) return false;
      if (filterLevel !== "All" && r.levelRack !== filterLevel) return false;
      if (colPallet && !r.palletCode.toLowerCase().includes(colPallet.toLowerCase())) return false;
      if (colSku && !(r.currentSku || "").toLowerCase().includes(colSku.toLowerCase())) return false;
      return true;
    });
    if (sortCol) {
      out = [...out].sort((a, b) => {
        const get = (r: PalletMasterRow) => {
          if (sortCol === "pallet") return r.palletCode;
          if (sortCol === "gudang") return r.gudang;
          if (sortCol === "zone") return r.zoneType;
          if (sortCol === "level") return r.levelRack;
          if (sortCol === "sku") return r.currentSku || "";
          if (sortCol === "status") return r.status;
          return "";
        };
        const av = get(a).toLowerCase();
        const bv = get(b).toLowerCase();
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return out;
  }, [masterRows, search, filterGudang, filterZone, filterStatus, filterLevel, colPallet, colSku, sortCol, sortDir]);

  const gudangOptions = useMemo(() => ["All", ...Array.from(new Set(masterRows.map((r) => r.gudang).filter(Boolean)))], [masterRows]);
  const zoneOptions = useMemo(() => ["All", ...Array.from(new Set(masterRows.map((r) => r.zoneType).filter(Boolean)))], [masterRows]);
  const statusOptions = useMemo(() => ["All", ...Array.from(new Set(masterRows.map((r) => r.status).filter(Boolean)))], [masterRows]);
  const levelOptions = useMemo(() => ["All", ...Array.from(new Set(masterRows.map((r) => r.levelRack).filter(Boolean)))], [masterRows]);

  function handleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }
  function clearAllFilters() {
    setSearch(""); setFilterGudang("All"); setFilterZone("All"); setFilterStatus("All"); setFilterLevel("All"); setColPallet(""); setColSku("");
  }

  function toggleSelect(code: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(code)) n.delete(code); else n.add(code);
      return n;
    });
  }
  function selectAllFiltered() {
    setSelected(new Set(filteredMaster.map((r) => r.palletCode)));
  }
  function clearSelected() {
    setSelected(new Set());
  }
  function generateFromSelected() {
    const toAdd = masterRows.filter((r) => selected.has(r.palletCode));
    if (!toAdd.length) return;
    const base = activeCard;
    const newCards = toAdd.map((r) => masterToCard(r, base));
    setCards((p) => [...p, ...newCards]);
    // set active to first new
    if (newCards.length) setActiveId(newCards[0].id);
  }
  function generateFromFiltered() {
    const newCards = filteredMaster.map((r) => masterToCard(r, activeCard));
    setCards((p) => [...p, ...newCards]);
    if (newCards.length) setActiveId(newCards[0].id);
  }
  function generateAllMaster() {
    const newCards = masterRows.map((r) => masterToCard(r, activeCard));
    setCards((p) => [...p, ...newCards]);
    if (newCards.length) setActiveId(newCards[0].id);
  }

  // Bulk Print A4 + Generate & Print
  function triggerPrint(cardsToPrint: StockCardData[] | null, layout: "1" | "2") {
    if (cardsToPrint && cardsToPrint.length) setEphemeralPrint(cardsToPrint);
    else setEphemeralPrint(null);
    setPrintLayout(layout);
    // wait for DOM then print
    setTimeout(() => window.print(), 350);
  }
  function generateAndPrintSelected() {
    const sel = masterRows.filter((r) => selected.has(r.palletCode));
    if (!sel.length) return;
    const newCards = sel.map((r) => masterToCard(r, activeCard));
    setCards((p) => [...p, ...newCards]);
    if (newCards.length) setActiveId(newCards[0].id);
    // Generate & Print: print only the newly generated selected cards in A4
    triggerPrint(newCards, printLayout);
  }
  function handleBulkPrintA4(target: "all" | "selected" | "filtered") {
    let toPrint: StockCardData[] = [];
    if (target === "all") toPrint = cards;
    else if (target === "filtered") toPrint = filteredMaster.map((r) => masterToCard(r, activeCard));
    else if (target === "selected") {
      // Prefer printing from queue that matches selected pallet codes, else from master
      const selectedCodes = selected;
      const queueSelected = cards.filter((c) => selectedCodes.has(c.palletCode));
      if (queueSelected.length) toPrint = queueSelected;
      else toPrint = masterRows.filter((r) => selectedCodes.has(r.palletCode)).map((r) => masterToCard(r, activeCard));
    }
    if (!toPrint.length) return;
    triggerPrint(toPrint, printLayout);
  }

  // persist - queue now starts empty, migrate old dummy single-card storage
  useEffect(() => {
    const saved = localStorage.getItem("kartustock:cards");
    const savedDraft = localStorage.getItem("kartustock:draft");
    if (savedDraft) {
      try { const d = JSON.parse(savedDraft); if (d && d.palletCode) setDraft(d); } catch {}
    }
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) {
          // migrate: if only dummy C12-DRY-08 Sticker Labelling and nothing else, treat as empty (user wanted no pending)
          const isDummyOnly = parsed.length === 1 && parsed[0].palletCode === "C12-DRY-08" && parsed[0].skuName === "Sticker Labelling";
          if (!isDummyOnly) {
            setCards(parsed);
            setActiveId(parsed[0].id);
          } else {
            localStorage.setItem("kartustock:cards", JSON.stringify([]));
          }
        }
      } catch {}
    }
    const savedMaster = localStorage.getItem("kartustock:masterRows");
    if (savedMaster) {
      try { const p = JSON.parse(savedMaster); if (Array.isArray(p) && p.length) setMasterRows(p); } catch {}
    }
    const savedUrl = localStorage.getItem("kartustock:sheetUrl");
    if (savedUrl) setSheetUrl(savedUrl);
  }, []);

  useEffect(() => {
    localStorage.setItem("kartustock:cards", JSON.stringify(cards));
    fetch("/api/cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cards) }).catch(() => {});
  }, [cards]);
  useEffect(() => { localStorage.setItem("kartustock:draft", JSON.stringify(draft)); }, [draft]);

  useEffect(() => { localStorage.setItem("kartustock:masterRows", JSON.stringify(masterRows)); }, [masterRows]);
  useEffect(() => { localStorage.setItem("kartustock:sheetUrl", sheetUrl); }, [sheetUrl]);

  // clear ephemeral print after printing (so next normal Bulk Print prints all)
  useEffect(() => {
    const clear = () => setEphemeralPrint(null);
    window.addEventListener("afterprint", clear);
    return () => window.removeEventListener("afterprint", clear);
  }, []);

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
      {/* MASTER DATA PANEL */}
      <div className="no-print bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <button onClick={() => setShowMaster(!showMaster)} className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-zinc-900 to-zinc-800 text-white">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-amber-500 grid place-items-center text-black font-black text-sm">{masterRows.length || "◉"}</span>
            <div className="text-left">
              <div className="font-black text-sm flex items-center gap-2">Master Data — Pallet Mapping <span className="bg-amber-500 text-black text-[10px] px-2 py-0.5 rounded-full">NEW</span></div>
              <div className="text-xs text-zinc-400">{masterRows.length ? `${masterRows.length} pallets loaded • ${selected.size} selected • ${filteredMaster.length} filtered` : "Connect your Google Sheets 'Pallet Code' tab or upload CSV → choose pallets to generate Stock Cards"}</div>
            </div>
          </div>
          <span className={`w-8 h-8 rounded-full bg-white/10 grid place-items-center transition ${showMaster ? "rotate-180" : ""}`}>▼</span>
        </button>

        {showMaster && (
          <div className="p-5 space-y-4">
            {/* Load row */}
            <div className="grid lg:grid-cols-[1fr_auto] gap-3">
              <div className="flex gap-2">
                <input value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="Paste Google Sheets URL (https://docs.google.com/spreadsheets/d/.../edit#gid=1688169041)" className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-amber-500" />
                <button onClick={loadFromSheet} disabled={loadingSheet} className="bg-amber-500 text-black font-black px-6 py-3 rounded-xl text-sm disabled:opacity-50 whitespace-nowrap hover:bg-amber-400">
                  {loadingSheet ? "Loading…" : "↗ Load Sheet"}
                </button>
              </div>
              <div className="flex gap-2">
                <label className="flex-1 lg:flex-none bg-zinc-900 text-white px-5 py-3 rounded-xl text-sm font-bold text-center cursor-pointer hover:bg-black">
                  📄 Upload Master CSV
                  <input type="file" accept=".csv" className="hidden" onChange={handleMasterCSVUpload} />
                </label>
                {masterRows.length > 0 && <button onClick={() => { setMasterRows([]); setSelected(new Set()); setMasterSource(""); localStorage.removeItem("kartustock:masterRows"); }} className="px-4 py-3 rounded-xl border border-zinc-200 text-sm font-semibold">Clear</button>}
              </div>
            </div>
            {sheetError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 leading-relaxed space-y-2">
                <div>{sheetError}</div>
                {sheetUrl && !sheetUrl.includes("gid=") && (
                  <button onClick={() => setSheetUrl(sheetUrl.replace(/#.*$/, "") + (sheetUrl.includes("?") ? "&" : "?") + "gid=1688169041")} className="bg-red-600 text-white px-3 py-1.5 rounded-full font-bold text-xs">Fix URL → Add Pallet Code gid</button>
                )}
              </div>
            )}
            {!sheetError && masterSource && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl px-4 py-2.5">✓ {masterSource} — ready. Use filters & checkboxes below, then generate.</div>}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs leading-relaxed text-amber-900">
              <b>How to connect:</b> Open the <b>“Pallet Code” tab</b> specifically → <b>Share → General access → Anyone with link (Viewer)</b> → Copy URL from address bar (must contain <code className="bg-white px-1 rounded">gid=1688169041</code>) → Load. Or <b>File → Download → CSV</b> and upload. The app auto-detects side-by-side tables (C11/C12 etc).
              <br/><span className="text-amber-700">Privacy: URL is stored only in your browser (localStorage), never hardcoded or sent elsewhere except to fetch the sheet. Auto-fallback tries Pallet Code tab even if you paste URL without gid.</span>
            </div>

            {masterRows.length > 0 && (
              <>
                {/* Filters - sticky, always visible above table */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_140px_140px_140px_140px] gap-2">
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Global search: pallet / SKU / zone…" className="bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
                    <select value={filterGudang} onChange={(e) => setFilterGudang(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm">
                      {gudangOptions.map((o) => <option key={o} value={o}>{o === "All" ? "All Gudang" : o}</option>)}
                    </select>
                    <select value={filterZone} onChange={(e) => setFilterZone(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm">
                      {zoneOptions.map((o) => <option key={o} value={o}>{o === "All" ? "All Zone" : o}</option>)}
                    </select>
                    <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm">
                      {levelOptions.map((o) => <option key={o} value={o}>{o === "All" ? "All Level/Rack" : o}</option>)}
                    </select>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm">
                      {statusOptions.map((o) => <option key={o} value={o}>{o === "All" ? "All Status" : o}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center text-xs">
                    <span className="bg-zinc-900 text-white px-3 py-1.5 rounded-full font-bold">Showing {filteredMaster.length} / {masterRows.length}</span>
                    {(search || filterGudang !== "All" || filterZone !== "All" || filterLevel !== "All" || filterStatus !== "All" || colPallet || colSku) && (
                      <button onClick={clearAllFilters} className="bg-white border border-zinc-200 px-3 py-1.5 rounded-full font-semibold hover:bg-zinc-50">✕ Clear all filters</button>
                    )}
                    {sortCol && <span className="text-zinc-500">Sorted by {sortCol} {sortDir === "asc" ? "↑" : "↓"}</span>}
                  </div>
                </div>

                {/* Simplified Actions - flagship, clean */}
                <div className="bg-zinc-900 rounded-xl p-3 flex flex-wrap gap-2 items-center border border-zinc-800">
                  <button onClick={selectAllFiltered} className="text-xs bg-white text-black px-4 py-2.5 rounded-full font-bold">Select filtered ({filteredMaster.length})</button>
                  <button onClick={clearSelected} className="text-xs bg-zinc-800 text-white border border-zinc-700 px-4 py-2.5 rounded-full font-semibold">Clear</button>
                  <span className="hidden sm:block w-px h-6 bg-zinc-700 mx-1" />
                  <span className="text-xs text-zinc-400 hidden lg:block">{selected.size} selected</span>
                  <div className="flex-1" />
                  <div className="flex items-center gap-2">
                    <select value={printLayout} onChange={(e) => setPrintLayout(e.target.value as "1" | "2")} className="bg-white text-black rounded-full px-3 py-1.5 text-xs font-bold border border-zinc-200">
                      <option value="1">1 / A4</option>
                      <option value="2">2 / A4</option>
                    </select>
                  </div>
                  <button onClick={generateFromSelected} disabled={selected.size === 0} className="text-xs bg-amber-500 text-black px-5 py-2.5 rounded-full font-black disabled:opacity-40">Generate {selected.size ? `(${selected.size})` : ""}</button>
                  <button onClick={generateAndPrintSelected} disabled={selected.size === 0} className="text-xs bg-white text-zinc-900 border border-white px-5 py-2.5 rounded-full font-black disabled:opacity-40">🖨️ Print {selected.size ? `(${selected.size})` : ""} → A4</button>
                </div>

                {/* Table */}
                <div className="border border-zinc-200 rounded-xl overflow-hidden">
                  <div className="max-h-[480px] overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 z-10 bg-zinc-900 text-white text-[11px] tracking-wide">
                        <tr>
                          <th className="p-2.5 text-center w-10">
                            <input type="checkbox" checked={filteredMaster.length > 0 && filteredMaster.every((r) => selected.has(r.palletCode))} onChange={(e) => e.target.checked ? selectAllFiltered() : clearSelected()} />
                          </th>
                          <th className="p-2.5 text-left cursor-pointer select-none" onClick={() => handleSort("pallet")}>Pallet Code {sortCol==="pallet" ? (sortDir==="asc"?"↑":"↓") : "↕"}</th>
                          <th className="p-2.5 text-left cursor-pointer select-none" onClick={() => handleSort("gudang")}>Gudang {sortCol==="gudang" ? (sortDir==="asc"?"↑":"↓") : "↕"}</th>
                          <th className="p-2.5 text-left cursor-pointer select-none" onClick={() => handleSort("zone")}>Zone {sortCol==="zone" ? (sortDir==="asc"?"↑":"↓") : "↕"}</th>
                          <th className="p-2.5 text-left cursor-pointer select-none" onClick={() => handleSort("level")}>Level/Rack {sortCol==="level" ? (sortDir==="asc"?"↑":"↓") : "↕"}</th>
                          <th className="p-2.5 text-left">Max Cap</th>
                          <th className="p-2.5 text-left cursor-pointer select-none" onClick={() => handleSort("sku")}>SKU {sortCol==="sku" ? (sortDir==="asc"?"↑":"↓") : "↕"}</th>
                          <th className="p-2.5 text-left cursor-pointer select-none" onClick={() => handleSort("status")}>Status {sortCol==="status" ? (sortDir==="asc"?"↑":"↓") : "↕"}</th>
                        </tr>
                        {/* Per-column quick filters directly on table */}
                        <tr className="bg-white text-black">
                          <th className="p-1.5"></th>
                          <th className="p-1.5"><input value={colPallet} onChange={(e)=>setColPallet(e.target.value)} placeholder="Filter code…" className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 text-xs font-normal placeholder:text-zinc-400" /></th>
                          <th className="p-1.5"></th>
                          <th className="p-1.5"></th>
                          <th className="p-1.5"></th>
                          <th className="p-1.5"></th>
                          <th className="p-1.5"><input value={colSku} onChange={(e)=>setColSku(e.target.value)} placeholder="Filter SKU…" className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 text-xs font-normal placeholder:text-zinc-400" /></th>
                          <th className="p-1.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMaster.map((r) => (
                          <tr key={r.palletCode} className={`border-t border-zinc-100 hover:bg-amber-50/60 ${selected.has(r.palletCode) ? "bg-amber-100/70" : "bg-white"}`}>
                            <td className="p-2.5 text-center"><input type="checkbox" checked={selected.has(r.palletCode)} onChange={() => toggleSelect(r.palletCode)} /></td>
                            <td className="p-2.5 font-mono font-bold">{r.palletCode}</td>
                            <td className="p-2.5">{r.gudang || "—"}</td>
                            <td className="p-2.5">{r.zoneType || "—"}</td>
                            <td className="p-2.5">{r.levelRack || "—"}</td>
                            <td className="p-2.5">{r.maxCapacity && r.maxCapacity !== "-" ? `${r.maxCapacity} (${r.inPack})` : "—"}</td>
                            <td className="p-2.5 max-w-[180px] truncate" title={r.currentSku}>{r.currentSku && r.currentSku !== "None" ? r.currentSku : <span className="text-zinc-400">—</span>}</td>
                            <td className="p-2.5"><span className={`px-2 py-1 rounded-full text-[10px] font-bold ${r.status.toLowerCase().includes("avail") ? "bg-emerald-100 text-emerald-700" : r.status.toLowerCase().includes("occup") ? "bg-orange-100 text-orange-700" : "bg-zinc-100"}`}>{r.status || "—"}</span></td>
                          </tr>
                        ))}
                        {filteredMaster.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-zinc-400">No pallets match filters</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="text-[11px] text-zinc-500">Tip: Selected pallets become Stock Cards with Zone = Zone Type • Level/Rack, SKU = Current Assigned SKU, Max Qty = Max Capacity. You can still edit each card after generation.</div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 items-start">
        {/* LEFT PANEL - FORM */}
        <div className="no-print sticky top-[72px] space-y-4">
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
                onClick={() => {
                  setCards([]);
                  setActiveId(null);
                  setDraft({ ...defaultCard, id: "draft" });
                  localStorage.removeItem("kartustock:cards");
                  localStorage.removeItem("kartustock:draft");
                }}
                className="col-span-2 text-xs text-zinc-500 font-semibold py-2 hover:text-red-600"
              >
                Reset all (clear)
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

          <div ref={previewRef} className="bg-[#EEF0F2] p-4 sm:p-8 rounded-[24px] border border-zinc-200 shadow-inner">
            <StockCard data={activeCard} />
            <div className="no-print mt-4 flex justify-center gap-2 text-[10px] text-zinc-500">
              <span>◀ Use tabs on left to edit each card</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">Print shows only the card (no UI)</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 p-4 no-print">
            <div className="flex flex-wrap gap-2 justify-between items-center mb-3">
              <h3 className="text-xs font-black tracking-widest text-zinc-500 uppercase">Bulk Print Queue — A4 Ready</h3>
              <div className="flex gap-2 items-center">
                <select value={printLayout} onChange={(e) => setPrintLayout(e.target.value as "1" | "2")} className="bg-zinc-900 text-white rounded-full px-3 py-1.5 text-xs font-bold">
                  <option value="1">1 / A4</option>
                  <option value="2">2 / A4</option>
                </select>
                <button onClick={() => triggerPrint(null, printLayout)} disabled={!cards.length} className="text-xs bg-amber-500 text-black px-4 py-2 rounded-full font-black disabled:opacity-40">🖨️ Bulk Print A4 — All ({cards.length})</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[520px] overflow-auto p-1">
              {cards.length === 0 ? (
                <div className="col-span-2 py-12 text-center border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50">
                  <div className="text-sm font-bold text-zinc-600">No cards in queue</div>
                  <div className="text-xs text-zinc-400 mt-1">Generate from Master Data above or create with + New. Edit Card Details on left and print preview directly.</div>
                </div>
              ) : (
                cards.map((c) => (
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
                ))
              )}
            </div>
            {cards.length > 0 && <div className="mt-3 flex gap-2">
              <button onClick={() => triggerPrint(cards, printLayout)} className="flex-1 bg-zinc-900 text-white py-2.5 rounded-xl text-xs font-black">🖨️ Print All {cards.length} Cards — {printLayout === "2" ? "2 per A4 (saving)" : "1 per A4"}</button>
            </div>}
          </div>

          {/* Ephemeral / Bulk Print A4 - print only */}
          <div className="hidden print:block">
            {(() => {
              const fallback = cards.length ? cards : [draft];
              const toPrint = ephemeralPrint && ephemeralPrint.length ? ephemeralPrint : fallback;
              if (printLayout === "2") {
                // 2 cards per A4
                return (
                  <div className="space-y-4">
                    {toPrint.map((c, idx) => (
                      <div key={c.id} style={{ breakInside: "avoid", breakAfter: (idx % 2 === 1 && idx !== toPrint.length - 1) ? "page" : "auto", marginBottom: idx % 2 === 0 ? "8mm" : "0" }}>
                        <StockCard data={c} />
                      </div>
                    ))}
                  </div>
                );
              }
              return (
                <div className="space-y-8">
                  {toPrint.map((c) => (
                    <div key={c.id} style={{ breakAfter: "page", breakInside: "avoid" }}>
                      <StockCard data={c} />
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
