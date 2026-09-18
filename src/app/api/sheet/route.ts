import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") return NextResponse.json({ error: "Missing url" }, { status: 400 });
    const { id, gid } = extract(url) || {};
    if (!id) return NextResponse.json({ error: "Invalid Google Sheets URL. Expected https://docs.google.com/spreadsheets/d/<ID>/edit#gid=... " }, { status: 400 });

    const gidParam = gid ? `&gid=${gid}` : "";
    const urlsToTry = [
      `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gidParam}`,
      `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv${gidParam ? `&gid=${gid}` : ""}`,
    ];

    let lastErr = "";
    for (const u of urlsToTry) {
      try {
        const r = await fetch(u, { cache: "no-store", redirect: "follow" });
        const text = await r.text();
        if (!r.ok) {
          lastErr = `HTTP ${r.status}`;
          // if login page, text contains "Google Accounts" or "ServiceLogin"
          if (text.includes("ServiceLogin") || text.includes("accounts.google.com") || text.includes("Google Accounts") || text.toLowerCase().includes("sign in")) {
            lastErr = "Sheet is not public. Change Share → Anyone with link (Viewer) or File → Share → Publish to web → CSV, or download CSV manually and upload.";
          }
          continue;
        }
        if (text.includes("<!DOCTYPE html") && text.includes("accounts.google.com")) {
          lastErr = "Sheet is private. Please publish or share as Anyone with link.";
          continue;
        }
        if (text.length < 10) continue;
        // success: check looks like CSV (contains Pallet Code or commas)
        return NextResponse.json({ csv: text, sourceUrl: u });
      } catch (e: unknown) {
        lastErr = String(e);
      }
    }
    return NextResponse.json({ error: lastErr || "Failed to fetch sheet. Try CSV upload instead.", hint: "Make the sheet public: Open sheet → Share → General access → Anyone with link (Viewer) → Done. Or File → Download → Comma separated values (.csv) and upload." }, { status: 502 });
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
