"use client"

import { Printer, Check } from "lucide-react"
import { FONTS } from "@/lib/squeegee/brand"
import { paymentLabel, RECEIPT_BUSINESS, type ReceiptData } from "@/lib/squeegee/receipt-format"

const TEAL = "#2D8C6F"

function money(n: number): string {
  return `$${Number(n).toFixed(2)}`
}

// Stored phones are inconsistent ("7044511887", "704-451-1887"). A receipt is a
// document — it shows a formatted number.
function phone(raw: string): string {
  const d = raw.replace(/[^0-9]/g, "")
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d
  if (ten.length !== 10) return raw
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
}

function longDate(iso: string | null): string {
  if (!iso) return "—"
  // Date-only strings must not be shifted by the viewer's timezone.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso)
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

function dateTime(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  })
}

export function ReceiptView({ receipt }: { receipt: ReceiptData }) {
  return (
    <div className="min-h-screen bg-background py-8 px-4 print:bg-white print:py-0" style={{ fontFamily: FONTS.body }}>
      {/* Print rules: the receipt is a document first. Drop the app chrome, force
          light ink on white paper, and never split the totals across a page. */}
      <style>{`
        @media print {
          @page { margin: 14mm; }
          .no-print { display: none !important; }
          .receipt-card {
            border: 1px solid #ccc !important;
            box-shadow: none !important;
            break-inside: avoid;
          }
          html, body { background: #fff !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="max-w-lg mx-auto space-y-5">
        {/* Header */}
        <div className="text-center pb-1">
          <img src="/images/squeegee/logo-badge.png" alt="Dr. Squeegee" className="h-24 w-auto mx-auto mb-2" />
          <p className="text-sm text-muted-foreground print:text-black">{RECEIPT_BUSINESS.tagline}</p>
        </div>

        <div className="receipt-card bg-card print:bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: `${TEAL}33` }}>
          {/* Banner */}
          <div className="px-5 py-4 flex items-start justify-between gap-3" style={{ background: TEAL }}>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-white tracking-wide" style={{ fontFamily: FONTS.display }}>
                RECEIPT
              </h1>
              <p className="text-sm text-white/80 mt-0.5 truncate">{receipt.receiptNumber}</p>
            </div>
            <div className="shrink-0 flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
              <Check className="h-3.5 w-3.5 text-white" />
              <span className="text-xs font-bold text-white tracking-wide">PAID</span>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Amount paid — the single thing the customer opened this for. */}
            <div className="text-center py-3 rounded-xl" style={{ background: `${TEAL}0F` }}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground print:text-black">Amount paid</p>
              <p className="text-4xl font-black tabular-nums mt-0.5" style={{ fontFamily: FONTS.display, color: TEAL }}>
                {money(receipt.totalPaid)}
              </p>
              <p className="text-xs text-muted-foreground print:text-black mt-1">
                {dateTime(receipt.paidAt)} ET · {paymentLabel(receipt)}
              </p>
            </div>

            {/* Who paid / where the work happened */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground print:text-black mb-0.5">Billed to</p>
                <p className="font-medium text-foreground print:text-black">{receipt.clientName}</p>
                {receipt.clientPhone && (
                  <p className="text-xs text-muted-foreground print:text-black">{phone(receipt.clientPhone)}</p>
                )}
                {receipt.clientEmail && (
                  <p className="text-xs text-muted-foreground print:text-black break-all">{receipt.clientEmail}</p>
                )}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground print:text-black mb-0.5">Service address</p>
                <p className="text-foreground print:text-black">{receipt.address || "—"}</p>
                {receipt.servicedOn && (
                  <p className="text-xs text-muted-foreground print:text-black mt-0.5">
                    Serviced {longDate(receipt.servicedOn)}
                  </p>
                )}
              </div>
            </div>

            {/* Itemised work */}
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="text-xs uppercase tracking-wide text-muted-foreground print:text-black border-b"
                    style={{ borderColor: `${TEAL}33` }}
                  >
                    <th className="text-left pb-2 font-medium">Service</th>
                    <th className="text-right pb-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: `${TEAL}1A` }}>
                  {receipt.services.map((s, i) => (
                    <tr key={i}>
                      <td className="py-2.5">
                        <div className="text-foreground print:text-black font-medium">{s.name}</div>
                        {(s.detail || s.description) && (
                          <div className="text-xs text-muted-foreground print:text-black mt-0.5">
                            {s.detail || s.description}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-foreground print:text-black tabular-nums align-top">
                        {money(s.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {receipt.discountAmount > 0 && (
                    <>
                      <tr className="border-t-2" style={{ borderColor: `${TEAL}4D` }}>
                        <td className="pt-2 text-muted-foreground print:text-black text-xs">Subtotal</td>
                        <td className="pt-2 text-right text-muted-foreground print:text-black text-xs tabular-nums">
                          {money(receipt.subtotal)}
                        </td>
                      </tr>
                      <tr>
                        <td className="pt-1 text-xs font-medium" style={{ color: TEAL }}>
                          {receipt.discountLabel ?? "Discount"}
                        </td>
                        <td className="pt-1 text-right text-xs tabular-nums font-medium" style={{ color: TEAL }}>
                          −{money(receipt.discountAmount)}
                        </td>
                      </tr>
                    </>
                  )}
                  <tr className={receipt.discountAmount > 0 ? "" : "border-t-2"} style={receipt.discountAmount > 0 ? undefined : { borderColor: `${TEAL}4D` }}>
                    <td className="pt-2 text-muted-foreground print:text-black text-sm">Service total</td>
                    <td className="pt-2 text-right text-foreground print:text-black text-sm tabular-nums">
                      {money(receipt.serviceTotal)}
                    </td>
                  </tr>
                  {receipt.tip > 0 && (
                    <tr>
                      <td className="pt-1 text-muted-foreground print:text-black text-sm">Tip</td>
                      <td className="pt-1 text-right text-foreground print:text-black text-sm tabular-nums">
                        {money(receipt.tip)}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t" style={{ borderColor: `${TEAL}33` }}>
                    <td className="pt-3 font-bold text-foreground print:text-black">Total paid</td>
                    <td
                      className="pt-3 text-right font-black text-base tabular-nums"
                      style={{ fontFamily: FONTS.display, color: TEAL }}
                    >
                      {money(receipt.totalPaid)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Payment detail — what a bank statement can be matched against. */}
            <div className="rounded-xl border px-4 py-3 text-xs space-y-1" style={{ borderColor: `${TEAL}26` }}>
              <Row label="Payment method" value={paymentLabel(receipt)} />
              <Row label="Date paid" value={dateTime(receipt.paidAt) + " ET"} />
              <Row label="Invoice" value={receipt.invoiceNumber} />
              {receipt.transactionRef && <Row label="Transaction" value={receipt.transactionRef} mono />}
            </div>

            <p className="text-center text-xs text-muted-foreground print:text-black pt-1">
              Paid in full. Thank you for your business!
            </p>
          </div>

          {/* Who was paid */}
          <div className="px-5 py-4 border-t text-center text-xs leading-relaxed" style={{ borderColor: `${TEAL}26`, background: `${TEAL}08` }}>
            <p className="font-bold text-foreground print:text-black" style={{ fontFamily: FONTS.display }}>
              {RECEIPT_BUSINESS.entity}
            </p>
            <p className="text-muted-foreground print:text-black">{RECEIPT_BUSINESS.address}</p>
            <p className="text-muted-foreground print:text-black">
              {RECEIPT_BUSINESS.phone} · {RECEIPT_BUSINESS.domain}
            </p>
          </div>
        </div>

        <div className="no-print flex justify-center">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: TEAL }}
          >
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </button>
        </div>

        <p className="no-print text-center text-xs text-muted-foreground">
          Keep this link — your receipt stays here for your records.
        </p>
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground print:text-black shrink-0">{label}</span>
      <span className={`text-foreground print:text-black text-right break-all ${mono ? "font-mono text-[11px]" : ""}`}>
        {value}
      </span>
    </div>
  )
}
