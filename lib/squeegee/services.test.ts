import { test } from "node:test"
import assert from "node:assert/strict"
import {
  normalizeService,
  normalizeServices,
  deriveJobServices,
  splitServiceText,
  describeServices,
  type Service,
} from "./services.ts"

// Every distinct squeegee_jobs.service_type value in prod on 2026-09-08 (23),
// with the buckets each must resolve to. If a new spelling shows up, add it.
const LIVE_SPELLINGS: [string, Service[]][] = [
  ["Driveway", ["driveway"]],
  ["Surface Cleaning, Driveway", ["surfaces", "driveway"]],
  ["House Washing", ["house_wash"]],
  ["House Washing, Window Cleaning", ["house_wash", "windows"]],
  ["Pending Quote", []],
  ["Window Cleaning", ["windows"]],
  ["House Washing, Surface Cleaning", ["house_wash", "surfaces"]],
  ["House Wash, Windows", ["house_wash", "windows"]],
  ["Driveway, Back Deck", ["driveway", "surfaces"]],
  ["Driveway, Front Entryway Softwash", ["driveway", "surfaces"]],
  ["House Washing, Surface Cleaning, Window Cleaning", ["house_wash", "surfaces", "windows"]],
  ["Driveway, Surface Cleaning", ["driveway", "surfaces"]],
  ["Surface Cleaning, Driveway, Retaining Wall", ["surfaces", "driveway"]],
  ["Driveway, Front Entryway and Front Gutters Soft Wash", ["driveway", "surfaces", "gutters"]],
  ["Surface Cleaning", ["surfaces"]],
  ["House Washing, Surface Cleaning, Small Retaining wall", ["house_wash", "surfaces"]],
  ["Window Cleaning, Roof + Gutter Blow Off", ["windows", "roof", "gutters"]],
  ["House Washing, Window Cleaning, Driveway, Pavers", ["house_wash", "windows", "driveway", "pavers"]],
  ["Driveway, Pavers", ["driveway", "pavers"]],
  ["House Washing, Window Cleaning, Window Cleaning", ["house_wash", "windows"]],
  ["Door-to-door — Palisades", ["other"]],
  ["Surface Cleaning, Driveway, Pavers", ["surfaces", "driveway", "pavers"]],
  ["House Washing, Driveway, Gutter Cleaning", ["house_wash", "driveway", "gutters"]],
]

test("every live service_type spelling resolves to the expected buckets", () => {
  for (const [input, expected] of LIVE_SPELLINGS) {
    assert.deepEqual(normalizeServices(input), expected, input)
  }
})

test("Care Club catalog names resolve to one bucket each for pricing", () => {
  assert.equal(normalizeService("Window Cleaning"), "windows")
  assert.equal(normalizeService("Roof Wash + Gutter Clean"), "roof")
  assert.equal(normalizeService("House Washing"), "house_wash")
  assert.equal(normalizeService("Driveway / Courtyard Pressure Wash"), "driveway")
  assert.equal(normalizeService("Surface Cleaning"), "surfaces")
  assert.equal(normalizeService("Pool Deck"), "pool_deck")
})

test("earliest match wins for a single line", () => {
  assert.equal(normalizeService("Roof + Gutter Blow Off"), "roof")
  assert.equal(normalizeService("Front Entryway and Front Gutters Soft Wash"), "surfaces")
  assert.equal(normalizeService("Gutter and roof"), "gutters")
})

test("pool deck beats deck", () => {
  assert.equal(normalizeService("Pool Deck"), "pool_deck")
  assert.equal(normalizeService("Back Deck"), "surfaces")
  assert.deepEqual(normalizeServices("Pool Deck, Back Deck"), ["pool_deck", "surfaces"])
})

test("placeholders are empty, unknown real text is other", () => {
  for (const p of ["Pending Quote", "TBD", "Service", "n/a", "N/A", "-", "", "   ", "new job"]) {
    assert.deepEqual(normalizeServices(p), [], JSON.stringify(p))
    assert.equal(normalizeService(p), null, JSON.stringify(p))
  }
  assert.equal(normalizeService("Solar panel rinse"), "other")
  assert.deepEqual(normalizeServices("Door-to-door — Palisades"), ["other"])
  assert.deepEqual(normalizeServices(null), [])
  assert.deepEqual(normalizeServices(undefined), [])
})

test("arrays of strings and of quote line objects are accepted", () => {
  assert.deepEqual(normalizeServices(["House Washing", "Windows"]), ["house_wash", "windows"])
  assert.deepEqual(
    normalizeServices([{ name: "Driveway" }, { name: "Surface Cleaning" }, { name: null }, null]),
    ["driveway", "surfaces"]
  )
})

test("deriveJobServices prefers quote lines, falls back to service_type", () => {
  assert.deepEqual(deriveJobServices([{ name: "Window Cleaning" }], "House Washing"), ["windows"])
  assert.deepEqual(deriveJobServices([], "House Washing"), ["house_wash"])
  assert.deepEqual(deriveJobServices(null, "House Washing, Driveway"), ["house_wash", "driveway"])
  // A quote whose lines are all placeholders falls through to service_type.
  assert.deepEqual(deriveJobServices([{ name: "Service" }], "Driveway"), ["driveway"])
})

test("splitServiceText handles every joiner", () => {
  assert.deepEqual(splitServiceText("A, B + C & D and E; F | G"), ["A", "B", "C", "D", "E", "F", "G"])
  assert.deepEqual(splitServiceText("Sand and Stone"), ["Sand", "Stone"])
})

test("describeServices reads like a sentence fragment", () => {
  assert.equal(describeServices(["house_wash", "windows"]), "House wash, window cleaning")
  assert.equal(describeServices([]), "No service recorded")
})
