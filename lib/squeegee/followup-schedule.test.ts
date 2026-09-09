import { test } from "node:test"
import assert from "node:assert/strict"
import { selectFollowupTouch, withinSendWindowET, type FollowupCandidate } from "./followup-schedule.ts"

const NOW = new Date("2026-09-15T14:00:00Z") // 10am EDT

function candidate(over: Partial<FollowupCandidate> = {}): FollowupCandidate {
  return {
    id: "q1",
    createdAt: "2026-09-01T14:00:00Z",
    followupCount: 0,
    lastFollowupAt: null,
    quoteStatus: "pending",
    jobStatus: "quoted",
    hasPhone: true,
    optedOut: false,
    ...over,
  }
}

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString()
}

test("touch 1 fires at day 2, not before", () => {
  assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(1) }), NOW), null)
  assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(1.99) }), NOW), null)
  assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(2) }), NOW), 1)
  assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(6) }), NOW), 1)
})

test("touch 2 needs day 7 and one prior touch; touch 3 needs day 14 and two", () => {
  assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(6), followupCount: 1, lastFollowupAt: daysAgo(4) }), NOW), null)
  assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(7), followupCount: 1, lastFollowupAt: daysAgo(5) }), NOW), 2)
  assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(13), followupCount: 2, lastFollowupAt: daysAgo(6) }), NOW), null)
  assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(14), followupCount: 2, lastFollowupAt: daysAgo(7) }), NOW), 3)
  assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(15), followupCount: 2, lastFollowupAt: daysAgo(8) }), NOW), 3)
})

test("cap at three touches, ever", () => {
  assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(30), followupCount: 3, lastFollowupAt: daysAgo(16) }), NOW), null)
})

test("minimum gap between touches", () => {
  // Day 7 reached but the first touch went out yesterday (late) - wait.
  assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(7), followupCount: 1, lastFollowupAt: daysAgo(1) }), NOW), null)
  assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(7), followupCount: 1, lastFollowupAt: daysAgo(2) }), NOW), 2)
})

test("help quotes are never auto-texted", () => {
  assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(3), quoteStatus: "help" }), NOW), null)
  assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(3), quoteStatus: "accepted" }), NOW), null)
})

test("a job that advanced stops the sequence; orphan quotes stay eligible", () => {
  for (const s of ["approved", "scheduled", "complete", "cancelled"]) {
    assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(3), jobStatus: s }), NOW), null, s)
  }
  assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(3), jobStatus: null }), NOW), 1)
  assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(3), jobStatus: "new" }), NOW), 1)
})

test("no phone, opted out, excluded, or too old -> nothing", () => {
  assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(3), hasPhone: false }), NOW), null)
  assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(3), optedOut: true }), NOW), null)
  assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(3), excluded: true }), NOW), null)
  assert.equal(selectFollowupTouch(candidate({ createdAt: daysAgo(46) }), NOW), null)
})

test("send window is 9:00-19:59 ET, across DST", () => {
  // Summer (EDT, UTC-4)
  assert.equal(withinSendWindowET(new Date("2026-07-15T12:59:00Z")), false) // 8:59
  assert.equal(withinSendWindowET(new Date("2026-07-15T13:00:00Z")), true) // 9:00
  assert.equal(withinSendWindowET(new Date("2026-07-15T23:59:00Z")), true) // 19:59
  assert.equal(withinSendWindowET(new Date("2026-07-16T00:00:00Z")), false) // 20:00
  // Winter (EST, UTC-5)
  assert.equal(withinSendWindowET(new Date("2026-01-15T13:59:00Z")), false) // 8:59
  assert.equal(withinSendWindowET(new Date("2026-01-15T14:00:00Z")), true) // 9:00
  assert.equal(withinSendWindowET(new Date("2026-01-16T00:59:00Z")), true) // 19:59
  assert.equal(withinSendWindowET(new Date("2026-01-16T01:00:00Z")), false) // 20:00
})
