import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await prisma.googleConnection.deleteMany({
    where: { userId: user.id },
  })

  await prisma.draft.updateMany({
    where: { userId: user.id, googleConnectionId: { not: null } },
    data: { googleConnectionId: null },
  })

  return NextResponse.json({ success: true })
}
