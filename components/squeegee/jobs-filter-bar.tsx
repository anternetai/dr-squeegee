"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { STATUS_ORDER, STATUS_LABELS, JobStatus } from "@/lib/squeegee/types"

interface JobsFilterBarProps {
  activeStatus?: string
}

export function JobsFilterBar({ activeStatus }: JobsFilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/crm/jobs"
        className={cn(
          "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
          !activeStatus
            ? "bg-[#3A6B4C] text-white"
            : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        )}
      >
        All
      </Link>
      {STATUS_ORDER.map((status) => (
        <Link
          key={status}
          href={`/crm/jobs?status=${status}`}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
            activeStatus === status
              ? "bg-[#3A6B4C] text-white"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          )}
        >
          {STATUS_LABELS[status as JobStatus]}
        </Link>
      ))}
    </div>
  )
}
