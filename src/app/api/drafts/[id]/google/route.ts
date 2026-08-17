import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { getAuthUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseGoogleSpreadsheetId, verifyGoogleSheetAccess, createGoogleErrorResponse, getGoogleOAuthClient, getGoogleTokensForUser } from "@/lib/google-auth"
import { getDraftExportRows } from "@/lib/export"

function quoteSheetName(name: string) {
  return `'${name.replace(/'/g, "''")}'`
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const action = typeof body.action === "string" ? body.action : "update"
  const draft = await prisma.draft.findFirst({
    where: { id, userId: user.id },
    include: { googleConnection: true },
  })

  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 })

  const userGoogleConnection = await prisma.googleConnection.findUnique({
    where: { userId: user.id },
  })
  const activeGoogleConnection = draft.googleConnection ?? userGoogleConnection

  const spreadsheetUrl = typeof body.spreadsheetUrl === "string" ? body.spreadsheetUrl.trim() : draft.googleSheetUrl ?? ""
  const spreadsheetId = parseGoogleSpreadsheetId(spreadsheetUrl) ?? draft.googleSpreadsheetId
  const worksheetName = typeof body.worksheetName === "string" ? body.worksheetName.trim() : draft.googleWorksheetName ?? "Assignments"

  if (!spreadsheetId) {
    return NextResponse.json({ error: "Please provide a valid Google Sheets URL" }, { status: 400 })
  }

  if (!activeGoogleConnection) {
    return NextResponse.json({ error: "Please connect your Google account first" }, { status: 400 })
  }

  try {
    await verifyGoogleSheetAccess(user.id, spreadsheetId)

    await prisma.draft.update({
      where: { id },
      data: {
        googleSheetUrl: spreadsheetUrl,
        googleSpreadsheetId: spreadsheetId,
        googleWorksheetName: worksheetName || "Assignments",
        googleConnectionId: activeGoogleConnection.id,
      },
    })

    if (action === "test") {
      return NextResponse.json({ success: true, message: "Google Sheets connection verified" })
    }

    const tokens = await getGoogleTokensForUser(user.id)
    if (!tokens) {
      throw new Error("Google authorization is not available. Please reconnect your Google account.")
    }

    const client = getGoogleOAuthClient()
    client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    })

    const sheets = google.sheets({ version: "v4", auth: client })
    const rows = await getDraftExportRows(id)
    const sheetValues = [
      ["Name", "DAYS REGISTERED", "ASSIGNMENT"],
      ...rows.map((row) => [row.Name, row["DAYS REGISTERED"], row.ASSIGNMENT]),
    ]

    const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId })
    const targetSheet = spreadsheetMeta.data.sheets?.find((sheet) => sheet.properties?.title === worksheetName)

    let sheetId: number | null | undefined
    if (!targetSheet) {
      const created = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: worksheetName } } }],
        },
      })
      sheetId = created.data.replies?.[0]?.addSheet?.properties?.sheetId
    } else {
      sheetId = targetSheet.properties?.sheetId
    }

    if (sheetId === null || sheetId === undefined) {
      throw new Error("Google Sheets worksheet could not be prepared")
    }

    const sheetRange = `${quoteSheetName(worksheetName)}!A:Z`
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: sheetRange,
    })

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteSheetName(worksheetName)}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: sheetValues,
      },
    })

    return NextResponse.json({ success: true, message: "Google Sheet updated" })
  } catch (error) {
    return createGoogleErrorResponse(error, "Unable to update Google Sheet")
  }
}
