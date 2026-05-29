import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"
import { ALL_ROWS, EDGE_ROWS, SPONSORSHIP_CONFIG } from "@/lib/constants"
import { getSegmentBooths } from "@/lib/booth-geometry"
import type { Day, BoothAssignment } from "@/types"

const VALID_DAYS = new Set<Day>(["WEDNESDAY", "THURSDAY"])

function getSegmentOrder(row: string): number[] {
  return EDGE_ROWS.has(row) ? [2, 1] : [3, 2, 4, 1]
}

function findNextPlacement(
  count: number,
  occupied: Set<string>
): string[] | null {
  for (const row of ALL_ROWS) {
    const segmentOrder = getSegmentOrder(row)
    for (const segment of segmentOrder) {
      const segmentBooths = getSegmentBooths(row, segment)
      if (segmentBooths.length < count) continue

      for (let i = 0; i <= segmentBooths.length - count; i += 1) {
        const group = segmentBooths.slice(i, i + count)
        if (group.every((b) => !occupied.has(b.id))) {
          return group.map((b) => b.id)
        }
      }
    }
  }

  return null
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { draftId, day } = await req.json()
  if (!draftId || !VALID_DAYS.has(day)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const draft = await prisma.draft.findFirst({
    where: { id: draftId, userId: user.id },
    include: { companies: true, assignments: true },
  })

  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const assignedCompanyIds = new Set(draft.assignments.map((a) => a.companyId))
  const occupied = new Set<string>()

  for (const assignment of draft.assignments) {
    if (assignment.day === null || assignment.day === day) {
      for (const boothId of assignment.boothIds) {
        occupied.add(boothId)
      }
    }
  }

  const unassignedCompanies = draft.companies.filter(
    (company) =>
      !assignedCompanyIds.has(company.id) && company.days.includes(day)
  )

  const orderedCompanies = [...unassignedCompanies].sort((a, b) => {
    const boothCountA = SPONSORSHIP_CONFIG[a.sponsorship].booths
    const boothCountB = SPONSORSHIP_CONFIG[b.sponsorship].booths
    if (boothCountB !== boothCountA) return boothCountB - boothCountA
    return a.name.localeCompare(b.name)
  })

  const assignmentData: Array<{
    companyId: string
    draftId: string
    boothIds: string[]
    day: Day | null
  }> = []

  for (const company of orderedCompanies) {
    const boothCount = SPONSORSHIP_CONFIG[company.sponsorship].booths
    const placement = findNextPlacement(boothCount, occupied)
    if (!placement) break

    const assignmentDay = company.days.length === 2 ? null : day
    assignmentData.push({
      companyId: company.id,
      draftId,
      boothIds: placement,
      day: assignmentDay,
    })

    for (const boothId of placement) {
      occupied.add(boothId)
    }
  }

  const created: BoothAssignment[] = assignmentData.length
    ? await prisma.$transaction(
        assignmentData.map((data) =>
          prisma.boothAssignment.create({ data })
        )
      )
    : []

  return NextResponse.json({
    created,
    placedCount: created.length,
    unassignedCount: unassignedCompanies.length,
    skippedCount: unassignedCompanies.length - created.length,
  })
}
