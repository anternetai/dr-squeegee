import { test } from "node:test"
import assert from "node:assert/strict"
import { resolveJobLeadSource, leadSourceFromWebLead, isLeadSource } from "./lead-source.ts"

test("explicit always wins", () => {
  assert.equal(resolveJobLeadSource("referral", 3, "google"), "referral")
  assert.equal(resolveJobLeadSource("repeat", 0, null), "repeat")
})

test("a prior job makes it repeat", () => {
  assert.equal(resolveJobLeadSource(null, 1, "door_knock"), "repeat")
  assert.equal(resolveJobLeadSource(undefined, 5, null), "repeat")
})

test("first job inherits the relationship's origin, else unknown", () => {
  assert.equal(resolveJobLeadSource(null, 0, "door_knock"), "door_knock")
  assert.equal(resolveJobLeadSource(null, 0, null), null)
  assert.equal(resolveJobLeadSource("bogus", 0, "bogus"), null)
})

test("web leads map onto the taxonomy", () => {
  assert.equal(leadSourceFromWebLead("landing_page", null), "website")
  assert.equal(leadSourceFromWebLead("landing_page", "google"), "google")
  assert.equal(leadSourceFromWebLead("landing_page", "facebook"), "social")
  assert.equal(leadSourceFromWebLead(null, null), "other")
  assert.equal(isLeadSource("repeat"), false)
})
