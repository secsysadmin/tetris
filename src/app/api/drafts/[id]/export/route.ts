import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"
import * as XLSX from "xlsx"
import { getDraftExportRows } from "@/lib/export"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const draft = await prisma.draft.findFirst({
    where: { id, userId: user.id },
  })

  if (!draft)
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  const rows = await getDraftExportRows(id)

  const sheet = XLSX.utils.json_to_sheet(rows)
  const csv = XLSX.utils.sheet_to_csv(sheet)

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${draft.name}-Assignments.csv"`,
    },
  })
}
