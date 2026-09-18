export interface StockCardData {
  id: string;
  palletCode: string;
  zone: string;
  skuName: string;
  maxQuota: string;
  expDate: string;
  qcCheck: string;
  rows: number; // number of blank rows
  paperSize: "A4" | "A3";
  orientation: "portrait" | "landscape";
}

export const defaultCard: StockCardData = {
  id: "1",
  palletCode: "C12-DRY-08",
  zone: "Floor",
  skuName: "Sticker Labelling",
  maxQuota: "",
  expDate: "",
  qcCheck: "",
  rows: 12,
  paperSize: "A4",
  orientation: "portrait",
};
