export interface PalletMasterRow {
  palletCode: string;
  gudang: string;
  zoneType: string;
  levelRack: string;
  maxCapacity: string;
  inPack: string;
  currentSku: string;
  currentStock: string;
  expDate: string;
  status: string;
}

// very small CSV parser handling quotes
function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out.map((s) => s.replace(/^"|"$/g, "").trim());
}

const PALLET_RE = /^[A-Z]{1,3}\d*-[A-Z0-9]+-[A-Z0-9\-]*\d+$/i;
// fallback broader: contains dash and not header
function isPalletCode(v: string): boolean {
  if (!v || v === "Pallet Code" || v.toLowerCase().includes("pallet")) return false;
  const s = v.trim();
  if (s.length < 6) return false;
  if (!s.includes("-")) return false;
  // allow C11-RC-A1-01, C12-DRY-08, C12-C28-01, etc
  if (PALLET_RE.test(s)) return true;
  // broader: at least 2 dashes and alphanum
  const dashes = (s.match(/-/g) || []).length;
  return dashes >= 2 && /^[A-Z0-9\-]+$/i.test(s) && s.length < 30;
}

export function parseMasterCSV(text: string): PalletMasterRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: PalletMasterRow[] = [];
  for (const raw of lines) {
    const cols = parseCSVLine(raw);
    if (cols.length < 3) continue;
    // header row skip if first col header
    if (cols[0] === "Pallet Code") continue;
    // scan for pallet codes in this line - handles dual side-by-side tables
    for (let idx = 0; idx < cols.length; idx++) {
      const v = cols[idx]?.trim();
      if (!isPalletCode(v)) continue;
      // avoid duplicate detection of same pallet splitted? check we have enough cols ahead
      const gudang = cols[idx + 1] ?? "";
      const zoneType = cols[idx + 2] ?? "";
      const levelRack = cols[idx + 3] ?? "";
      const maxCapacity = cols[idx + 4] ?? "";
      const inPack = cols[idx + 5] ?? "";
      const currentSku = cols[idx + 6] ?? "";
      const currentStock = cols[idx + 7] ?? "";
      const expDate = cols[idx + 8] ?? "";
      const status = cols[idx + 9] ?? "";
      // Heuristic: if gudang looks like "C11"/"C12"/"Gudang" and zoneType is Racking/Container etc, it's valid.
      // Even if not, we still keep if pallet code valid and row not header
      // Skip if this is actually a header fragment dupe (gudang header)
      if (gudang === "Gudang" && zoneType === "Zone Type") continue;
      // Also skip if colset is mostly empty and next pallet found soon (gap column)
      rows.push({
        palletCode: v,
        gudang,
        zoneType,
        levelRack,
        maxCapacity,
        inPack,
        currentSku,
        currentStock,
        expDate,
        status,
      });
      // jump ahead to avoid re-detecting same pallet's subfields as pallet (they contain - but unlikely)
      // move idx forward by 9 to next table
      idx += 9;
    }
  }
  // dedupe by palletCode
  const seen = new Set<string>();
  const deduped: PalletMasterRow[] = [];
  for (const r of rows) {
    if (!seen.has(r.palletCode)) {
      seen.add(r.palletCode);
      deduped.push(r);
    }
  }
  return deduped;
}

export function extractSheetIdAndGid(url: string): { id: string; gid: string | null } | null {
  try {
    const u = new URL(url.trim());
    const m = u.pathname.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!m) return null;
    const id = m[1];
    const gid = u.searchParams.get("gid");
    // also try hash fragment
    const hashGid = u.hash.match(/gid=([0-9]+)/);
    return { id, gid: gid || (hashGid ? hashGid[1] : null) };
  } catch {
    const m = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!m) return null;
    const gidMatch = url.match(/[#?&]gid=([0-9]+)/);
    return { id: m[1], gid: gidMatch ? gidMatch[1] : null };
  }
}
