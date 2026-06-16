export const NAVY = "#0B1F3A";
export const CREAM = "#F7F3EA";

export type OrderStatus =
  | "draft_sales" | "fitter_work" | "sales_model_input"
  | "invoice_draft" | "invoice_sent" | "done" | "cancelled";

export const STATUS: Record<OrderStatus, { label: string; col: string }> = {
  draft_sales:       { label: "Draft Sales",       col: "#8A8170" },
  fitter_work:       { label: "Pekerjaan Fitter",  col: "#2F6F8F" },
  sales_model_input: { label: "Input Model Sales", col: "#7A5C9E" },
  invoice_draft:     { label: "Invoice Draft",     col: "#B08642" },
  invoice_sent:      { label: "Invoice Terkirim",  col: "#3F7A4F" },
  done:              { label: "Selesai",           col: "#4B5563" },
  cancelled:         { label: "Cancelled",         col: "#C0392B" },
};

export const COLS_FULL: OrderStatus[] = [
  "draft_sales", "fitter_work", "sales_model_input",
  "invoice_draft", "invoice_sent", "done",
];
export const COLS_FITTER: OrderStatus[] = [
  "fitter_work", "invoice_draft", "invoice_sent", "done",
];
export const COLS_HEAD_FITTER: OrderStatus[] = [
  "draft_sales", "fitter_work", "invoice_draft", "invoice_sent", "done",
];

// kategori master_options → label tampil
export const MASTER_KEYS: { key: string; label: string }[] = [
  { key: "cutting", label: "Cutting" },
  { key: "fabric", label: "Jenis Kain" },
  { key: "collar", label: "Collar" },
  { key: "bottom_placket", label: "Bottom of Placket" },
  { key: "front_placket", label: "Front Placket" },
  { key: "pocket", label: "Pocket" },
  { key: "sleeve_cuff", label: "Sleeve (cuff)" },
  { key: "accessories", label: "Accessories" },
  { key: "add_on", label: "Add On" },
  { key: "cufflink", label: "Cufflink Additional" },
];
