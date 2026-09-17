import { test } from "node:test"
import assert from "node:assert/strict"
import {
  FIELD_STEPS,
  crewProfit,
  crewReplyKeyword,
  crewVerdict,
  fieldStateSentence,
  jobBasePay,
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

test("crewProfit sums revenue and pay, and refuses to divide by zero hours", () => {
  const jobs = [
    { price: 525, crew_pay: 150 },
    { price: 300, crew_pay: null },
    { price: 175, crew_pay: 50 },
  ]
  const p = crewProfit(jobs, 4 * 3_600_000)
  assert.equal(p.jobs, 3)
  assert.equal(p.revenue, 1000)
  assert.equal(p.crewPay, 200)
  assert.equal(p.crewPayJobs, 2)
  assert.equal(p.hours, 4)
  assert.equal(p.revenuePerHour, 250)
  assert.equal(p.netPerHour, 200)
  assert.equal(p.crewShare, 0.2)

  const none = crewProfit(jobs, 0)
  assert.equal(none.hours, 0)
  assert.equal(none.revenuePerHour, null)
  assert.equal(none.netPerHour, null)

  const empty = crewProfit([], 3_600_000)
  assert.equal(empty.revenue, 0)
  assert.equal(empty.crewShare, null)
})

test("crewVerdict says making / costing / nothing to compare", () => {
  assert.equal(crewVerdict("Marcus", 200, null).tone, "idle")
  assert.match(crewVerdict("Marcus", 200, null).text, /pays for themselves/)

  const good = crewVerdict("Marcus", 200, 131.25)
  assert.equal(good.tone, "accent")
  assert.match(good.text, /\$200\/hr after pay vs your solo \$131\/hr/)
  assert.match(good.text, /making you \$69\/hr/)

  const bad = crewVerdict("Marcus", 90, 131.25)
  assert.equal(bad.tone, "attention")
  assert.match(bad.text, /costing you \$41\/hr/)

  const noHours = crewVerdict("Marcus", null, 131.25)
  assert.equal(noHours.tone, "idle")
  assert.match(noHours.text, /No hours logged/)
})

test("jobBasePay derives hourly pay from the clock and lets an override win", () => {
  const eric = { pay_type: "hourly", pay_rate: 20 }
  assert.equal(jobBasePay(eric, 4 * 3_600_000, null), 80)
  assert.equal(jobBasePay(eric, 2.5 * 3_600_000, null), 50)
  assert.equal(jobBasePay(eric, 0, null), 0)
  assert.equal(jobBasePay(eric, 4 * 3_600_000, 95), 95)
  assert.equal(jobBasePay({ pay_type: "hourly", pay_rate: null }, 3_600_000, null), null)
  assert.equal(jobBasePay({ pay_type: "per_job", pay_rate: null }, 3_600_000, null), null)
  assert.equal(jobBasePay({ pay_type: "per_job", pay_rate: null }, 3_600_000, 150), 150)
  assert.equal(jobBasePay({ pay_type: "day_rate", pay_rate: 200 }, 3_600_000, null), null)
})
