import { google } from "googleapis"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI
const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

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

export async function getGoogleAccountIdentity(accessToken: string) {
  if (!accessToken) return null

  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`)
    if (!response.ok) return null

    const payload = await response.json() as {
      email?: string
      sub?: string
      user_id?: string
    }

    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : ""
    const googleUserId = typeof payload.sub === "string" ? payload.sub : typeof payload.user_id === "string" ? payload.user_id : ""

    if (!email && !googleUserId) return null

    return {
      email: email || "",
      googleUserId,
    }
  } catch {
    return null
  }
}

export async function getGoogleTokensForUser(userId: string) {
  const connection = await prisma.googleConnection.findUnique({
    where: { userId },
  })

  if (!connection) return null

  const accessToken = connection.accessToken?.trim()
  const refreshToken = connection.refreshToken?.trim()

  if (!accessToken && !refreshToken) {
    return null
  }

  if (connection.tokenExpiry && connection.tokenExpiry.getTime() <= Date.now()) {
    if (!refreshToken) return null

    const client = getGoogleOAuthClient()
    client.setCredentials({
      refresh_token: refreshToken,
      access_token: accessToken || undefined,
    })

    try {
      const { credentials } = await client.refreshAccessToken()
      const refreshedAccessToken = credentials.access_token?.trim() ?? accessToken ?? ""
      const refreshedRefreshToken = credentials.refresh_token?.trim() ?? refreshToken

      if (!refreshedAccessToken) {
        return null
      }

      const updated = await prisma.googleConnection.update({
        where: { userId },
        data: {
          accessToken: refreshedAccessToken,
          refreshToken: refreshedRefreshToken,
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

  if (!accessToken) {
    return null
  }

  return {
    accessToken,
    refreshToken: refreshToken || "",
    expiryDate: connection.tokenExpiry,
  }
}

export async function getGoogleSheetsClientForUser(userId: string) {
  const tokens = await getGoogleTokensForUser(userId)
  if (!tokens) return null

  const client = getGoogleOAuthClient()
  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  })

  return google.sheets({ version: "v4", auth: client })
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
  const sheets = await getGoogleSheetsClientForUser(userId)
  if (!sheets) {
    throw new Error("Google authorization is not available. Please reconnect your Google account.")
  }

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "spreadsheetId,properties.title",
  })

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
