import { NextRequest, NextResponse } from "next/server";

// Optional MySQL persistence - gracefully degrades if no DATABASE_URL
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ cards: [], note: "No DATABASE_URL - using localStorage fallback" });
  }
  try {
    const { prisma } = await import("@/lib/prisma");
    const cards = await prisma.stockCard.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return NextResponse.json({ cards });
  } catch (e) {
    return NextResponse.json({ cards: [], error: String(e) }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true, note: "No DB - saved to localStorage on client" });
  }
  try {
    const body = await req.json();
    const cards = Array.isArray(body) ? body : [body];
    const { prisma } = await import("@/lib/prisma");
    // Upsert only first card for demo, bulk is client-side
    for (const c of cards.slice(0, 50)) {
      if (!c.palletCode) continue;
      await prisma.stockCard.upsert({
        where: { id: c.id || "never" },
        update: {
          palletCode: String(c.palletCode),
          zone: String(c.zone || ""),
          skuName: String(c.skuName || ""),
          maxQuota: String(c.maxQuota || ""),
          expDate: String(c.expDate || ""),
          qcCheck: String(c.qcCheck || ""),
          rows: Number(c.rows || 12),
        },
        create: {
          palletCode: String(c.palletCode),
          zone: String(c.zone || ""),
          skuName: String(c.skuName || ""),
          maxQuota: String(c.maxQuota || ""),
          expDate: String(c.expDate || ""),
          qcCheck: String(c.qcCheck || ""),
          rows: Number(c.rows || 12),
        },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}
