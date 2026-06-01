import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { getAuthUser } from "@/lib/auth"
import { getBoothById } from "@/lib/booth-geometry"
import { ALL_ROWS } from "@/lib/constants"
import type { Industry, IndustryRangeConfig, IndustryRangeSpec } from "@/types"

const INDUSTRIES: Industry[] = [
  "AEROSPACE",
  "MECHANICAL",
  "ENERGY",
  "CHEMICALS",
  "OIL",
  "CIVIL",
  "TECH",
  "SEMICONDUCTORS",
  "OTHER",
]

function normalizeBoothId(raw: string): string | null {
  const value = raw.trim().toUpperCase()
  const match = value.match(/^([A-Q])\s*-?\s*(\d{1,2})$/)
  if (!match) return null
  const row = match[1]
  const num = parseInt(match[2], 10)
  const id = `${row}-${num}`
  return getBoothById(id) ? id : null
}

function normalizeIndustryRanges(raw: unknown): {
  value?: IndustryRangeConfig | null
  error?: string
} {
  if (raw === undefined) return { value: undefined }
  if (raw === null) return { value: null }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "industryRanges must be an object or null" }
  }

  const input = raw as Record<string, unknown>
  const output: IndustryRangeConfig = {}

  for (const [key, value] of Object.entries(input)) {
    if (!INDUSTRIES.includes(key as Industry)) {
      return { error: `Invalid industry key: ${key}` }
    }

    if (!Array.isArray(value)) {
      return { error: `Ranges for ${key} must be an array` }
    }

    const normalizedSpecs: IndustryRangeSpec[] = []
    for (const spec of value) {
      if (!spec || typeof spec !== "object") {
        return { error: `Invalid range entry for ${key}` }
      }

      const typed = spec as IndustryRangeSpec
      if (typed.type === "booth") {
        if (typeof typed.from !== "string" || typeof typed.to !== "string") {
          return { error: `Invalid booth range for ${key}` }
        }

        const fromId = normalizeBoothId(typed.from)
        const toId = normalizeBoothId(typed.to)
        if (!fromId || !toId) {
          return { error: `Invalid booth ID in ${key} ranges` }
        }

        normalizedSpecs.push({ type: "booth", from: fromId, to: toId })
      } else if (typed.type === "row") {
        if (typeof typed.from !== "string" || typeof typed.to !== "string") {
          return { error: `Invalid row range for ${key}` }
        }

        const fromRow = typed.from.trim().toUpperCase()
        const toRow = typed.to.trim().toUpperCase()
        if (!(ALL_ROWS as readonly string[]).includes(fromRow)) {
          return { error: `Invalid row in ${key} ranges` }
        }
        if (!(ALL_ROWS as readonly string[]).includes(toRow)) {
          return { error: `Invalid row in ${key} ranges` }
        }

        normalizedSpecs.push({ type: "row", from: fromRow, to: toRow })
      } else if (typed.type === "boothList") {
        const booths = Array.isArray(typed.booths) ? typed.booths : null
        if (!booths || booths.length === 0) {
          return { error: `Invalid booth list for ${key}` }
        }

        const normalized: string[] = []
        for (const boothRaw of booths) {
          if (typeof boothRaw !== "string") {
            return { error: `Invalid booth list for ${key}` }
          }
          const boothId = normalizeBoothId(boothRaw)
          if (!boothId) {
            return { error: `Invalid booth ID in ${key} list` }
          }
          normalized.push(boothId)
        }

        normalizedSpecs.push({ type: "boothList", booths: normalized })
      } else {
        return { error: `Invalid range type for ${key}` }
      }
    }

    output[key as Industry] = normalizedSpecs
  }

  return { value: output }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const draft = await prisma.draft.findFirst({
    where: { id, userId: user.id },
    include: {
      companies: true,
      assignments: true,
    },
  })

  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(draft)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const data: { name?: string; industryRanges?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput } = {}

  if (typeof body.name === "string") {
    data.name = body.name
  }

  if (Object.prototype.hasOwnProperty.call(body, "industryRanges")) {
    const normalized = normalizeIndustryRanges(body.industryRanges)
    if (normalized.error) {
      return NextResponse.json({ error: normalized.error }, { status: 400 })
    }
    if (normalized.value === null) {
      data.industryRanges = Prisma.JsonNull
    } else if (normalized.value !== undefined) {
      data.industryRanges = normalized.value as Prisma.InputJsonValue
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 })
  }

  const draft = await prisma.draft.updateMany({
    where: { id, userId: user.id },
    data,
  })

  if (draft.count === 0)
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  await prisma.draft.deleteMany({
    where: { id, userId: user.id },
  })

  return NextResponse.json({ success: true })
}
