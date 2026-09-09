import { test } from "node:test"
import assert from "node:assert/strict"
import {
  etNoonInstant,
  monthKeyET,
  dateKeyET,
  hourET,
  daysBetweenET,
  addMonthsYmd,
  monthsBetweenET,
  monthLabel,
  shortDateET,
} from "./dates.ts"

test("etNoonInstant anchors at noon ET in both daylight and standard time", () => {
  assert.equal(etNoonInstant("2026-09-02"), "2026-09-02T16:00:00.000Z") // EDT, UTC-4
  assert.equal(etNoonInstant("2026-01-01"), "2026-01-01T17:00:00.000Z") // EST, UTC-5
  // The DST switch days themselves.
  assert.equal(etNoonInstant("2026-03-08"), "2026-03-08T16:00:00.000Z")
  assert.equal(etNoonInstant("2026-11-01"), "2026-11-01T17:00:00.000Z")
})

test("etNoonInstant rejects anything that is not YYYY-MM-DD", () => {
  assert.throws(() => etNoonInstant("2026-9-2"))
  assert.throws(() => etNoonInstant("2026-09-02T00:00:00Z"))
})

test("month bucketing uses the ET calendar, not UTC", () => {
  // 9pm ET on New Year's Eve is 2am UTC on Jan 1. It belongs to December.
  assert.equal(monthKeyET("2026-01-01T02:00:00Z"), "2025-12")
  assert.equal(dateKeyET("2026-01-01T02:00:00Z"), "2025-12-31")
  assert.equal(monthKeyET("2026-09-02T16:00:00Z"), "2026-09")
  // Noon-anchored instants never cross a day.
  assert.equal(dateKeyET(etNoonInstant("2026-07-04")), "2026-07-04")
})

test("hourET reports the ET wall-clock hour", () => {
  assert.equal(hourET(new Date("2026-07-15T13:30:00Z")), 9) // EDT
  assert.equal(hourET(new Date("2026-01-15T13:30:00Z")), 8) // EST
  assert.equal(hourET(new Date("2026-07-15T04:00:00Z")), 0)
})

test("day arithmetic works on keys and instants", () => {
  assert.equal(daysBetweenET("2026-09-01", "2026-09-08"), 7)
  assert.equal(daysBetweenET("2026-09-08", "2026-09-01"), -7)
  assert.equal(daysBetweenET("2026-01-01T02:00:00Z", "2026-01-01T17:00:00Z"), 1)
  assert.equal(monthsBetweenET("2025-08-01", "2026-09-08"), 13)
})

test("addMonthsYmd clamps the day of month", () => {
  assert.equal(addMonthsYmd("2026-01-31", 1), "2026-02-28")
  assert.equal(addMonthsYmd("2024-01-31", 1), "2024-02-29")
  assert.equal(addMonthsYmd("2026-06-15", 12), "2027-06-15")
  assert.equal(addMonthsYmd("2026-11-15", 2), "2027-01-15")
})

test("labels", () => {
  assert.equal(monthLabel("2026-09"), "Sep 2026")
  assert.equal(shortDateET("2026-09-02"), "Sep 2")
  assert.equal(shortDateET("2026-01-01T02:00:00Z"), "Dec 31")
  assert.equal(shortDateET(null), "—")
})
