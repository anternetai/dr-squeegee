// Receipt shape + presentation helpers. Import-light on purpose: the receipt
// page is a client component, and pulling receipt.ts (which builds a
// service-role Supabase client) into the browser bundle would be both wasteful
// and a footgun. Server code gets these re-exported from receipt.ts.

import { BRAND } from "./brand"

export interface ReceiptService {
  name: string
  price: number
  detail?: string
  description?: string
}

export interface ReceiptData {
  receiptToken: string
  receiptNumber: string
  invoiceNumber: string
  invoiceId: string
  jobId: string | null

  clientName: string
  clientPhone: string | null
  clientEmail: string | null
  address: string

  services: ReceiptService[]
  subtotal: number
  discountLabel: string | null
  discountAmount: number
  serviceTotal: number
  tip: number
  totalPaid: number

  paidAt: string | null
  paymentMethod: string | null
  cardBrand: string | null
  cardLast4: string | null
  transactionRef: string | null

  jobServiceType: string | null
  servicedOn: string | null
}

/** "Visa ending in 3084" / "Cash" / "Zelle" — how the receipt names the tender. */
export function paymentLabel(r: Pick<ReceiptData, "paymentMethod" | "cardBrand" | "cardLast4">): string {
  if (r.cardBrand && r.cardLast4) {
    const brand = r.cardBrand.charAt(0).toUpperCase() + r.cardBrand.slice(1)
    return `${brand} ending in ${r.cardLast4}`
  }
  switch (r.paymentMethod) {
    case "stripe":
      return "Card"
    case "cash":
      return "Cash"
    case "zelle":
      return "Zelle"
    case "check":
      return "Check"
    default:
      return "Paid"
  }
}

/** Receipts are numbered off the invoice so the two are trivially reconcilable. */
export function receiptNumberFor(invoiceNumber: string): string {
  return invoiceNumber.replace(/^INV-/, "RCT-")
}

export const RECEIPT_BUSINESS = {
  entity: BRAND.entity,
  name: BRAND.name,
  address: BRAND.address,
  phone: BRAND.phone,
  domain: BRAND.domain,
  tagline: BRAND.tagline,
} as const
