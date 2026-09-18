import { NextRequest, NextResponse } from "next/server";

// lightweight CSV pallet detector for server-side validation (avoid importing full lib to keep edge compat)
function looksLikePalletCsv(csv: string): boolean {
  // quick check: does it contain a pallet-like code C11- or C12- or DRY etc?
  return /C1[12]-(?:RC|C28|C48)-[A-Z]?\d*-?\d*/i.test(csv) || /C12-DRY/i.test(csv) || /Pallet Code/i.test(csv);
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") return NextResponse.json({ error: "Missing url" }, { status: 400 });
    const extracted = extract(url);
    if (!extracted) return NextResponse.json({ error: "Invalid Google Sheets URL. Open your sheet → open the 'Pallet Code' tab → copy the URL from the address bar (it should contain gid=...)." }, { status: 400 });
    const { id, gid } = extracted;

    // Build gid candidates to try - the user often pastes URL without gid (defaults to first sheet, not Pallet Code)
    const candidates: (string | null)[] = [];
    if (gid) candidates.push(gid);
    // Known Pallet Code tab from this spreadsheet (from earlier links). Always try it if not already.
    const knownPalletGid = "1688169041";
    if (!candidates.includes(knownPalletGid)) candidates.push(knownPalletGid);
    if (!candidates.includes("0")) candidates.push("0");
    // Also try without gid param at all (some sheets work)
    candidates.push(null);

    // dedupe while preserving order
    const seen = new Set<string>();
    const uniqueCandidates: (string | null)[] = [];
    for (const c of candidates) {
      const key = c ?? "__null__";
      if (!seen.has(key)) { seen.add(key); uniqueCandidates.push(c); }
    }

    let lastErr = "";
    let lastCsvPreview = "";
    let attempted: string[] = [];

    for (const candGid of uniqueCandidates) {
      const gidParam = candGid ? `&gid=${candGid}` : "";
      const gidSuffix = candGid ? `&gid=${candGid}` : "";
      const urlsToTry = [
        `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gidParam}`,
        `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv${gidSuffix ? `&gid=${candGid}` : ""}`,
      ];
      for (const u of urlsToTry) {
        attempted.push(u);
        try {
          const r = await fetch(u, { cache: "no-store", redirect: "follow" });
          const text = await r.text();
          lastCsvPreview = text.slice(0, 800);
          if (!r.ok) {
            lastErr = `HTTP ${r.status} for gid=${candGid ?? "default"}`;
            if (text.includes("ServiceLogin") || text.includes("accounts.google.com") || text.includes("Google Accounts") || text.toLowerCase().includes("sign in")) {
              lastErr = "Sheet is not public. Change Share → Anyone with link (Viewer) or File → Share → Publish to web → CSV, or download CSV manually and upload.";
            }
            continue;
          }
          if (text.includes("<!DOCTYPE html") && (text.includes("accounts.google.com") || text.includes("ServiceLogin"))) {
            lastErr = "Sheet is private. Please publish or share as Anyone with link.";
            continue;
          }
          if (text.length < 20) { lastErr = "Empty response, try CSV upload."; continue; }
          // Validate it actually looks like pallet data; if not, this gid is wrong tab - continue to next candidate
          if (!looksLikePalletCsv(text)) {
            lastErr = `Tab gid=${candGid ?? "default"} does not contain Pallet Code data (fetched different sheet). Trying next tab…`;
            continue;
          }
          // success
          return NextResponse.json({ csv: text, sourceUrl: u, gid: candGid });
        } catch (e: unknown) {
          lastErr = String(e);
        }
      }
    }

    return NextResponse.json({
      error: lastErr || "No pallet rows found.",
      hint: "Tip: You pasted a URL without gid — open the 'Pallet Code' tab specifically, then copy the URL. It should look like .../edit#gid=1688169041. Or File → Download → CSV and upload.",
      attempted,
      preview: lastCsvPreview.slice(0, 500),
    }, { status: 502 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function extract(url: string): { id: string; gid: string | null } | null {
  try {
    const u = new URL(url.trim());
    const m = u.pathname.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!m) return null;
    const gid = u.searchParams.get("gid") || (() => { const h = u.hash.match(/gid=([0-9]+)/); return h ? h[1] : null; })();
    return { id: m[1], gid };
  } catch {
    const m = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!m) return null;
    const gidMatch = url.match(/[#?&]gid=([0-9]+)/);
    return { id: m[1], gid: gidMatch ? gidMatch[1] : null };
  }
}
