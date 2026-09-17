import { test } from "node:test"
import assert from "node:assert/strict"
import {
  FIELD_STEPS,
  crewReplyKeyword,
  fieldStateSentence,
  missingServices,
  nextStep,
  photoGateReason,
  serviceList,
  stepReached,
} from "./field.ts"

test("nextStep walks on_my_way → arrived → in_progress → complete", () => {
  assert.equal(nextStep({ status: "scheduled", field_status: null }), "on_my_way")
  assert.equal(nextStep({ status: "scheduled", field_status: "on_my_way" }), "arrived")
  assert.equal(nextStep({ status: "scheduled", field_status: "arrived" }), "in_progress")
  assert.equal(nextStep({ status: "scheduled", field_status: "in_progress" }), "complete")
  assert.equal(nextStep({ status: "complete", field_status: null }), null)
  assert.equal(FIELD_STEPS.map((s) => s.key).join(">"), "on_my_way>arrived>in_progress>complete")
})

test("stepReached fills the bar up to the current state", () => {
  const arrived = { status: "scheduled", field_status: "arrived" }
  assert.equal(stepReached(arrived, "on_my_way"), true)
  assert.equal(stepReached(arrived, "arrived"), true)
  assert.equal(stepReached(arrived, "in_progress"), false)
  assert.equal(stepReached(arrived, "complete"), false)
  assert.equal(stepReached({ status: "complete", field_status: null }, "complete"), true)
  assert.equal(fieldStateSentence(arrived).verb, "arrived")
})

test("serviceList splits, trims, dedupes case-insensitively, keeps first spelling", () => {
  assert.deepEqual(serviceList("House Washing, Window Cleaning, Window Cleaning"), ["House Washing", "Window Cleaning"])
  assert.deepEqual(serviceList("House Wash, windows, Windows "), ["House Wash", "windows"])
  assert.deepEqual(serviceList("Driveway"), ["Driveway"])
  assert.deepEqual(serviceList(""), ["Job"])
  assert.deepEqual(serviceList(null), ["Job"])
})

test("photo gate is per service and a null-service photo is a wildcard", () => {
  const services = ["House Wash", "Windows"]
  assert.equal(photoGateReason("before", services, []), "Before photos still needed: House Wash, Windows")
  assert.equal(
    photoGateReason("before", services, [{ kind: "before", service: "house wash" }]),
    "Add a before photo of the Windows first"
  )
  assert.equal(
    photoGateReason("before", services, [
      { kind: "before", service: "House Wash" },
      { kind: "before", service: "Windows" },
    ]),
    null
  )
  // after photos never satisfy the before gate
  assert.deepEqual(missingServices("before", services, [{ kind: "after", service: "Windows" }]), services)
  // legacy photo with no service counts for everything
  assert.equal(photoGateReason("after", services, [{ kind: "after", service: null }]), null)
  // single-service wording
  assert.equal(photoGateReason("after", ["Driveway"], []), "Add an after photo first")
})

test("crewReplyKeyword reads Anthony's YES/NO loosely", () => {
  assert.equal(crewReplyKeyword("YES"), "yes")
  assert.equal(crewReplyKeyword(" yes! "), "yes")
  assert.equal(crewReplyKeyword("y"), "yes")
  assert.equal(crewReplyKeyword("No"), "no")
  assert.equal(crewReplyKeyword("n"), "no")
  assert.equal(crewReplyKeyword("SEND"), null)
  assert.equal(crewReplyKeyword("yes please text them"), null)
})
