import type { OrderStatus } from "./constants";

export type Role = "super_admin" | "manager" | "sales" | "head_fitter" | "fitter";

export interface Profile {
  id: string;
  username: string | null;
  name: string;
  role: Role;
  active: boolean;
}

export interface Order {
  id: string;
  id_scalev: string;
  customer: string;
  tag: "order" | "repeat";
  need_fitter: boolean;
  status: OrderStatus;
  next_stage: OrderStatus;
  prev_status: OrderStatus | null;
  sales_id: string;
  wa_number: string | null;
  created_at: string;
  fitting_start_at: string | null;
  fitting_end_at: string | null;
  fitting_duration_minutes: number;
  fitting_started_at: string | null;
  fitting_started_by: string | null;
  sales_confirmed_at: string | null;
  sales_confirmed_by: string | null;
  fitter_assignment_status: "pending_sales_confirmation" | "ready_to_assign" | "assigned";
  assigned_by_head_fitter: string | null;
  assigned_at: string | null;
  sales?: { name: string } | null;
  order_fitters?: { fitter_id: string; profiles?: { name: string } | null }[];
  model_count?: { count: number }[];
}

export const MEASUREMENT_FIELDS: { key: string; label: string }[] = [
  { key: "height", label: "Tinggi badan" },
  { key: "weight", label: "Berat badan" },
  { key: "neck_circumference", label: "Lingkar leher" },
  { key: "shoulder", label: "Bahu" },
  { key: "sleeve_length", label: "Panjang lengan" },
  { key: "hand_circumference", label: "Lingkar tangan" },
  { key: "arm_circumference", label: "Lingkar lengan" },
  { key: "sleeve_opening_circumference", label: "Lingkar ujung lengan" },
  { key: "elbow", label: "Siku" },
  { key: "upper_arm", label: "Otot" },
  { key: "armpit", label: "Ketiak" },
  { key: "chest_circumference", label: "Lingkar dada" },
  { key: "waist_circumference", label: "Lingkar pinggang" },
  { key: "hip_circumference", label: "Lingkar pinggul" },
  { key: "gamis_length", label: "Panjang gamis" },
];

export interface OrderPerson {
  id: string;
  order_id: string;
  wearer_name: string;
  sort_order: number;
}

export type Measurement = { id?: string; order_id?: string } & Record<string, number | string | null | undefined>;

export interface MeasurementPhoto {
  id: string;
  order_id: string;
  storage_path: string;
  public_url: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_user_id: string | null;
  recipient_role: Role | null;
  type: string;
  title: string;
  message: string;
  order_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface ModelPackage {
  id: string;
  order_id: string;
  person_id: string | null;
  wearer_name: string | null;
  cutting: string | null;
  fabric: string | null;
  color: string | null;
  collar: string | null;
  bottom_placket: string | null;
  front_placket: string | null;
  pocket: string | null;
  sleeve_cuff: string | null;
  accessories: string | null;
  add_on: string | null;
  cufflink: string | null;
  note: string | null;
  price: number;
  input_by: string | null;
  input_role: Role | null;
  created_at: string;
  input_profile?: { name: string } | null;
}

export interface Invoice {
  id: string;
  order_id: string;
  number: string;
  number_active: string;
  slug: string;
  total: number;
  sent: boolean;
  sent_to: string | null;
  sent_by: string | null;
  sent_at: string | null;
  created_at: string;
  invoice_revisions?: InvoiceRevision[];
}

export interface InvoiceRevision {
  id: string;
  rev: number;
  old_total: number;
  new_total: number;
  reason: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  actor_name: string | null;
  actor_role: Role | null;
  action: string;
  text: string;
  created_at: string;
}
