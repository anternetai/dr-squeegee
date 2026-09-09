import { test } from "node:test"
import assert from "node:assert/strict"
import { mergeCadence, DEFAULT_CADENCE_MONTHS, isSeasonalMonth } from "./cadence.ts"

test("defaults are the industry cadences Anthony picked", () => {
  assert.equal(DEFAULT_CADENCE_MONTHS.house_wash, 12)
  assert.equal(DEFAULT_CADENCE_MONTHS.windows, 6)
  assert.equal(DEFAULT_CADENCE_MONTHS.gutters, 6)
  assert.equal(DEFAULT_CADENCE_MONTHS.roof, 24)
  assert.equal(DEFAULT_CADENCE_MONTHS.other, null)
})

test("mergeCadence takes valid overrides and ignores garbage", () => {
  const merged = mergeCadence({ windows: 4, roof: "36", house_wash: 0, driveway: "nope", pavers: null, bogus: 9 })
  assert.equal(merged.windows, 4)
  assert.equal(merged.roof, 36)
  assert.equal(merged.house_wash, 12) // 0 is out of range -> default kept
  assert.equal(merged.driveway, 12)
  assert.equal(merged.pavers, null) // explicit null = never due
  assert.equal(mergeCadence(null).windows, 6)
  assert.equal(mergeCadence("x").windows, 6)
})

test("seasonal months", () => {
  assert.equal(isSeasonalMonth("gutters", 10), true)
  assert.equal(isSeasonalMonth("gutters", 11), true)
  assert.equal(isSeasonalMonth("gutters", 5), false)
  assert.equal(isSeasonalMonth("house_wash", 3), true)
  assert.equal(isSeasonalMonth("windows", 11), true)
  assert.equal(isSeasonalMonth("other", 1), false)
})
