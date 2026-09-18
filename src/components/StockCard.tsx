"use client";
import { StockCardData } from "@/lib/types";

export function StockCard({ data, showQR = true }: { data: StockCardData; showQR?: boolean }) {
  return (
    <div className="print-card bg-white text-black border-[2.5px] border-black w-full max-w-[760px] mx-auto print-break-inside-avoid select-none">
      {/* Header */}
      <div className="bg-[#FF9D0A] border-b-[2.5px] border-black py-3.5 px-4 text-center">
        <h1 className="text-[48px] leading-none font-black tracking-tight text-black" style={{ fontFamily: "Arial Black, Arial, sans-serif" }}>
          Stock Card
        </h1>
      </div>

      {/* Info Grid - 2 cols */}
      <div className="grid grid-cols-2 text-[12px] leading-tight">
        {/* Row 1 */}
        <div className="flex border-r border-b border-black px-2 py-2.5 items-center gap-1">
          <span className="font-bold whitespace-nowrap text-[11px]">Pallet Code:</span>
          <span className="flex-1 text-center bg-[#EDEEF0] rounded-full px-2 py-1 text-[11px] font-semibold border border-gray-200 mx-1 truncate">
            {data.palletCode || "—"}
          </span>
        </div>
        <div className="flex border-b border-black px-2 py-2.5 items-center justify-between gap-2">
          <span className="font-bold text-[11px]">Zone:</span>
          <span className="flex-1 text-center font-semibold text-[11px]">{data.zone || "—"}</span>
        </div>

        {/* Row 2 */}
        <div className="flex border-r border-b border-black px-2 py-3 gap-2">
          <span className="font-bold text-[11px] whitespace-nowrap">SKU Name:</span>
          <span className="flex-1 text-center font-bold text-[11px] leading-tight">{data.skuName || "—"}</span>
        </div>
        <div className="flex border-b border-black px-2 py-3 gap-2">
          <span className="font-bold text-[11px] whitespace-nowrap">Max Quota:</span>
          <span className="flex-1 text-center text-[11px] font-medium">{data.maxQuota || ""}</span>
        </div>

        {/* Row 3 */}
        <div className="flex border-r border-b-[2.5px] border-black px-2 py-3 gap-2 min-h-[44px]">
          <span className="font-bold text-[11px] whitespace-nowrap">Exp Date:</span>
          <span className="flex-1 text-center text-[11px]">{data.expDate || ""}</span>
        </div>
        <div className="flex border-b-[2.5px] border-black px-2 py-3 gap-2 min-h-[44px]">
          <span className="font-bold text-[11px] whitespace-nowrap">QC Check:</span>
          <span className="flex-1 text-center text-[11px]">{data.qcCheck || ""}</span>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[1.05fr_1.2fr_0.95fr_0.95fr_1.15fr_0.85fr] bg-[#8A8A8A] text-white text-[8.5px] font-bold text-center border-b-[2px] border-black">
        <div className="py-1.5 border-r border-black">DATE</div>
        <div className="py-1.5 border-r border-black">Remark</div>
        <div className="py-1.5 border-r border-black">QTY IN</div>
        <div className="py-1.5 border-r border-black">QTY OUT</div>
        <div className="py-1.5 border-r border-black">Stock Balance</div>
        <div className="py-1.5">PIC</div>
      </div>

      {/* Blank Rows */}
      <div>
        {Array.from({ length: data.rows }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[1.05fr_1.2fr_0.95fr_0.95fr_1.15fr_0.85fr] text-[10px] leading-none"
            style={{ height: "48px" }}
          >
            <div className="border-r border-b border-black" />
            <div className="border-r border-b border-black" />
            <div className="border-r border-b border-black" />
            <div className="border-r border-b border-black" />
            <div className="border-r border-b border-black" />
            <div className="border-b border-black" />
          </div>
        ))}
      </div>

      {/* Footer mini */}
      {showQR && (
        <div className="flex justify-between items-center px-2 py-1.5 bg-[#F8F8F8] border-t border-black text-[7px] text-gray-600">
          <span>Kartu Stock Generator • Vittoria Warehouse • {new Date().getFullYear()}</span>
          <span className="font-mono font-bold tracking-widest">PALLET: {data.palletCode || "—"}</span>
        </div>
      )}
    </div>
  );
}

// Compact version for grid previews
export function StockCardMini({ data }: { data: StockCardData }) {
  return (
    <div className="bg-white text-black border-2 border-black w-full scale-[0.85] origin-top">
      <StockCard data={data} showQR={false} />
    </div>
  );
}
