export type JobStatus = "new" | "quoted" | "approved" | "scheduled" | "complete"

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
}

export const STATUS_ORDER: JobStatus[] = ["new", "quoted", "approved", "scheduled", "complete"]

export const STATUS_LABELS: Record<JobStatus, string> = {
  new: "New",
  quoted: "Quoted",
  approved: "Approved",
  scheduled: "Scheduled",
  complete: "Complete",
}

export const SERVICE_TYPES = [
  "House Washing",
  "Surface Cleaning",
  "Driveway",
  "Pool Deck",
  "Pavers",
] as const

export type ServiceType = (typeof SERVICE_TYPES)[number]

export interface SqueegeeClient {
  id: string
  created_at: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
}

export interface SqueegeeInvoice {
  id: string
  created_at: string
  job_id: string
  client_id: string | null
  invoice_number: string
  amount: number
  status: "draft" | "sent" | "paid" | "overdue"
  due_date: string | null
  paid_at: string | null
  stripe_payment_link: string | null
  stripe_payment_intent_id: string | null
  payment_method: "stripe" | "cash" | "zelle" | "check" | null
  notes: string | null
}

export interface SqueegeeActivityItem {
  id: string
  created_at: string
  job_id: string
  type: string
  note: string
}
