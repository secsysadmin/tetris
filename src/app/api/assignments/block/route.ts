import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"
import { getBoothById } from "@/lib/booth-geometry"
import type { Day, BoothAssignment } from "@/types"

const VALID_DAYS = new Set<Day>(["WEDNESDAY", "THURSDAY"])

function getBlockedName(boothId: string, day: Day) {
  return `Blocked Booth ${boothId} ${day}`
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { draftId, boothId, day } = await req.json()

  if (!draftId || !boothId || !VALID_DAYS.has(day)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  if (!getBoothById(boothId)) {
    return NextResponse.json({ error: "Invalid booth" }, { status: 400 })
  }

  const draft = await prisma.draft.findFirst({
    where: { id: draftId, userId: user.id },
  })
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const existingAssignments = await prisma.boothAssignment.findMany({
    where: { draftId },
    include: { company: true },
  })

  for (const existing of existingAssignments) {
    const daysOverlap = existing.day === null || existing.day === day
    if (daysOverlap && existing.boothIds.includes(boothId)) {
      return NextResponse.json(
        { error: "Booth already assigned" },
        { status: 409 }
      )
    }
  }

  const company = await prisma.company.create({
    data: {
      name: getBlockedName(boothId, day),
      days: [day],
      sponsorship: "BASIC",
      hasQueue: false,
      industry: "OTHER",
      isPlaceholder: true,
      draftId,
    },
  })

  const assignment: BoothAssignment = await prisma.boothAssignment.create({
    data: {
      companyId: company.id,
      draftId,
      boothIds: [boothId],
      day,
    },
  })

  return NextResponse.json({ assignment, company }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { assignmentId } = await req.json()
  if (!assignmentId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const assignment = await prisma.boothAssignment.findUnique({
    where: { id: assignmentId },
    include: { draft: true, company: true },
  })

  if (!assignment || assignment.draft.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (assignment.company.isPlaceholder) {
    await prisma.company.delete({ where: { id: assignment.companyId } })
  } else {
    await prisma.boothAssignment.delete({ where: { id: assignmentId } })
  }

  return NextResponse.json({ success: true })
}
