export type JobStatus = "new" | "quoted" | "approved" | "scheduled" | "complete" | "cancelled"

export interface SqueegeeJob {
  id: string
  created_at: string
  client_name: string
  client_phone: string
  client_email: string
  address: string
  service_type: string
  notes: string | null
  price: number | null
  status: JobStatus
  appointment_date: string | null
  appointment_time: string | null
  client_id?: string | null
  google_calendar_event_id?: string | null
  cal_booking_uid?: string | null
  completed_at?: string | null
  completion_note?: string | null
  reminder_sent_at?: string | null
  // Crew fields. field_status is the crew's own axis and is independent of
  // `status` above — see lib/squeegee/crew.ts.
  assigned_employee_id?: string | null
  field_status?: string | null
  claimed_at?: string | null
  crew_pay?: number | null
  // CRM v3 (2026-09-08). lead_source: how THIS job arrived ("repeat" is derived,
  // see lib/squeegee/lead-source.ts). excluded_at: test/junk rows are excluded
  // from every metric rather than deleted — a delete cascades paid invoices.
  lead_source?: JobLeadSource | null
  excluded_at?: string | null
}

/** The pipeline, in order. `cancelled` is deliberately not here: lost work
 *  leaves the board (it has its own tab on /crm/jobs). */
export const STATUS_ORDER: JobStatus[] = ["new", "quoted", "approved", "scheduled", "complete"]

export const STATUS_LABELS: Record<JobStatus, string> = {
  new: "New",
  quoted: "Quoted",
  approved: "Approved",
  scheduled: "Scheduled",
  complete: "Complete",
  cancelled: "Lost",
}

export const SERVICE_TYPES = [
  "House Washing",
  "Window Cleaning",
  "Surface Cleaning",
  "Driveway",
  "Pool Deck",
  "Pavers",
] as const

export type ServiceType = (typeof SERVICE_TYPES)[number]

export type LeadSource =
  | "door_knock"
  | "google"
  | "referral"
  | "nextdoor"
  | "yard_sign"
  | "social"
  | "website"
  | "other"
export type JobLeadSource = LeadSource | "repeat"

export interface SqueegeeClient {
  id: string
  created_at: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  blacklisted: boolean
  blacklist_reason: string | null
  sms_consent?: boolean
  sms_consent_at?: string | null
  sms_consent_method?: string | null
  // CRM v3. lead_source = how the relationship began, set once, never "repeat".
  lead_source?: LeadSource | null
  lead_source_at?: string | null
  lead_source_note?: string | null
  tags?: string[]
}

export type QuoteStatus = "pending" | "accepted" | "declined" | "help" | "superseded"
export type QuoteAcceptedVia = "customer" | "sms_intake" | "auto_close" | "close_out" | "reconcile" | "manual"

export interface QuoteLine {
  name: string
  price: number
  detail?: string | null
}

export interface SqueegeeQuote {
  id: string
  created_at: string
  token: string
  job_id: string | null
  client_name: string
  client_phone: string | null
  client_email: string | null
  address: string | null
  services: QuoteLine[] | null
  subtotal: number | null
  discount_type: "percent" | "dollar" | null
  discount_value: number | null
  total_price: number
  status: QuoteStatus
  // Set ONLY by the customer's own tap on /q (quotes/[token]/respond).
  client_response_at: string | null
  // CRM v3. How an accepted quote got there; "customer" and "sms_intake" are the
  // only two that count toward the headline win rate.
  accepted_via?: QuoteAcceptedVia | null
  closed_at?: string | null
  close_note?: string | null
  superseded_by?: string | null
  excluded_at?: string | null
  followup_count?: number
  last_followup_at?: string | null
  last_digest_at?: string | null
}

export type PaymentMethod = "stripe" | "card" | "cash" | "zelle" | "check"

export interface SqueegeeInvoice {
  id: string
  created_at: string
  job_id: string | null
  client_id: string | null
  quote_id: string | null
  invoice_number: string
  amount: number
  tip_amount: number
  status: "draft" | "sent" | "paid" | "overdue"
  due_date: string | null
  paid_at: string | null
  stripe_payment_link: string | null
  stripe_payment_intent_id: string | null
  /** null = paid but the tender was never recorded ("unrecorded" in reports). */
  payment_method: PaymentMethod | null
  notes: string | null
  sent_at?: string | null
  // Receipt fields — populated once an invoice is paid. receipt_token is the
  // public /r/[token] URL the customer keeps; card_* come from the Stripe charge.
  receipt_token?: string | null
  receipt_sent_at?: string | null
  card_brand?: string | null
  card_last4?: string | null
}

export const EXPENSE_CATEGORIES = [
  "chemicals",
  "fuel",
  "vehicle",
  "equipment",
  "repairs",
  "insurance",
  "software",
  "marketing",
  "supplies",
  "fees",
  "permits",
  "other",
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  chemicals: "Chemicals",
  fuel: "Fuel",
  vehicle: "Vehicle",
  equipment: "Equipment",
  repairs: "Repairs",
  insurance: "Insurance",
  software: "Software",
  marketing: "Marketing",
  supplies: "Supplies",
  fees: "Fees",
  permits: "Permits",
  other: "Other",
}

/** Crew pay is NOT an expense category on purpose: it lives on
 *  squeegee_jobs.crew_pay and is subtracted separately, so it can't be
 *  double-counted. */
export interface SqueegeeExpense {
  id: string
  created_at: string
  spent_on: string
  amount: number
  category: ExpenseCategory
  vendor: string | null
  note: string | null
  receipt_path: string | null
  job_id: string | null
  created_by: string
}

export interface SqueegeeSettingsRow {
  key: string
  value: unknown
  updated_at: string
}

export interface SqueegeeActivityItem {
  id: string
  created_at: string
  job_id: string
  type: string
  note: string
}
