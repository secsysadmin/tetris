import { google } from "googleapis"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI
const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/drive.file"]

function ensureGoogleConfig() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error("Google OAuth environment variables are not configured")
  }
}

export function getGoogleOAuthClient() {
  ensureGoogleConfig()
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  )
}

export function getGoogleOAuthUrl(state: string) {
  const client = getGoogleOAuthClient()
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state,
  })
}

export async function exchangeGoogleCode(code: string) {
  const client = getGoogleOAuthClient()
  const { tokens } = await client.getToken(code)
  return tokens
}

export async function getGoogleTokensForUser(userId: string) {
  const connection = await prisma.googleConnection.findUnique({
    where: { userId },
  })

  if (!connection) return null

  if (connection.tokenExpiry && connection.tokenExpiry.getTime() <= Date.now()) {
    const client = getGoogleOAuthClient()
    client.setCredentials({
      refresh_token: connection.refreshToken,
      access_token: connection.accessToken,
    })

    try {
      const { credentials } = await client.refreshAccessToken()
      const updated = await prisma.googleConnection.update({
        where: { userId },
        data: {
          accessToken: credentials.access_token ?? connection.accessToken,
          refreshToken: credentials.refresh_token ?? connection.refreshToken,
          tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        },
      })

      return {
        accessToken: updated.accessToken,
        refreshToken: updated.refreshToken,
        expiryDate: updated.tokenExpiry,
      }
    } catch {
      return null
    }
  }

  return {
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    expiryDate: connection.tokenExpiry,
  }
}

export async function getGoogleDriveClientForUser(userId: string) {
  const tokens = await getGoogleTokensForUser(userId)
  if (!tokens) return null

  const client = getGoogleOAuthClient()
  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  })

  return google.drive({ version: "v3", auth: client })
}

export function parseGoogleSpreadsheetId(url: string) {
  try {
    const parsed = new URL(url)
    const match = parsed.pathname.match(/\/spreadsheets\/d\/([^/]+)/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

export async function verifyGoogleSheetAccess(userId: string, spreadsheetId: string) {
  const drive = await getGoogleDriveClientForUser(userId)
  if (!drive) {
    throw new Error("Google authorization is not available. Please reconnect your Google account.")
  }

  const response = await drive.files.get({
    fileId: spreadsheetId,
    fields: "id,name,capabilities",
  })

  const capabilities = response.data.capabilities ?? {}
  if (!capabilities.canEdit) {
    throw new Error("The connected Google account does not have edit access to that spreadsheet.")
  }

  return response.data
}

export function createGoogleErrorResponse(error: unknown, fallback = "Google Sheets update failed") {
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ error: fallback }, { status: 500 })
}

export function createGoogleState() {
  const random = Math.random().toString(36).slice(2)
  return `google-${Date.now()}-${random}`
}

export function getGoogleAuthRedirectUrl(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "http://localhost:3000"
  return new URL(origin)
}
