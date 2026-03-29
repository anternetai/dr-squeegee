import { Droplets, CarFront, Fence, Waves, BrickWall } from "lucide-react"

export const SERVICES = [
  {
    name: "House Washing",
    description: "Soft wash of exterior siding, eaves, and trim",
    icon: Droplets,
  },
  {
    name: "Surface Cleaning",
    description: "High-pressure cleaning of walkways and patios",
    icon: Fence,
  },
  {
    name: "Driveway",
    description: "Full driveway pressure wash — oil stains, tire marks, buildup",
    icon: CarFront,
  },
  {
    name: "Pool Deck",
    description: "Pressure wash and surface treatment of pool deck",
    icon: Waves,
  },
  {
    name: "Pavers",
    description: "Paver pressure wash with joint sand preservation",
    icon: BrickWall,
  },
] as const

export const REVIEWS = [
  {
    name: "Sarah M.",
    neighborhood: "Ballantyne",
    text: "They did an amazing job on our house wash. The siding looks brand new! Very professional and on time.",
  },
  {
    name: "James T.",
    neighborhood: "South End",
    text: "Best pressure washing I've ever had. My driveway had years of buildup and they got it spotless.",
  },
  {
    name: "Lisa K.",
    neighborhood: "Huntersville",
    text: "Super responsive, fair pricing, and incredible results. Our pool deck looks like the day it was poured.",
  },
  {
    name: "Mike R.",
    neighborhood: "Matthews",
    text: "Called for a quote and they were out within two days. House looks amazing — neighbors are asking who we used!",
  },
  {
    name: "Angela D.",
    neighborhood: "Mint Hill",
    text: "We had algae all over our pavers and walkways. Dr. Squeegee made everything look new again. Highly recommend.",
  },
  {
    name: "Chris W.",
    neighborhood: "University Area",
    text: "Professional crew, great communication, fair price. My whole property looks 10 years newer. Will definitely use again.",
  },
] as const

export const SERVICE_OPTIONS = [
  "House Washing",
  "Driveway",
  "Surface Cleaning",
  "Pool Deck",
  "Pavers",
  "Other",
] as const

export const PROPERTY_TYPES = [
  "House",
  "Townhome",
  "Commercial",
  "Other",
] as const

export const TIMELINES = [
  "ASAP",
  "This Month",
  "Just Getting Prices",
  "Flexible",
] as const
