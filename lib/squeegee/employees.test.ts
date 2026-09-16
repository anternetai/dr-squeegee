import { test } from "node:test"
import assert from "node:assert/strict"
import { joinMode } from "./employees.ts"

test("joinMode: a fresh invite runs full onboarding", () => {
  assert.equal(joinMode({ onboarded_at: null, pin_hash: null }), "onboard")
  // A PIN with no onboarding can't happen through the app, but if a row ever
  // looks like that the agreement is still unsigned, so onboarding wins.
  assert.equal(joinMode({ onboarded_at: null, pin_hash: "x:y" }), "onboard")
})

test("joinMode: onboarded with no PIN only asks for a PIN", () => {
  // The pre-v2 crew row (email+password era) and every PIN reset land here.
  assert.equal(joinMode({ onboarded_at: "2026-07-25T03:30:06Z", pin_hash: null }), "set_pin")
})

test("joinMode: onboarded with a PIN means the link is spent", () => {
  assert.equal(joinMode({ onboarded_at: "2026-07-25T03:30:06Z", pin_hash: "salt:hash" }), "done")
})
