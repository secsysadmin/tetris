import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exchangeGoogleCode, getGoogleOAuthClient, createGoogleErrorResponse, getGoogleAccountIdentity } from "@/lib/google-auth"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.json({ error: "Google authorization was declined" }, { status: 400 })
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Invalid Google authorization response" }, { status: 400 })
  }

  const storedState = req.cookies.get("google_oauth_state")?.value
  if (!storedState || storedState !== state) {
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 })
  }

  const stateParts = state.split(":")
  const [, userId, encodedRedirectTo] = stateParts
  if (!userId) {
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 })
  }

  const redirectTarget = encodedRedirectTo ? decodeURIComponent(encodedRedirectTo) : "/dashboard"

  try {
    const tokens = await exchangeGoogleCode(code)
    const accessToken = tokens.access_token?.trim() ?? ""
    const refreshToken = tokens.refresh_token?.trim() ?? ""

    if (!accessToken && !refreshToken) {
      throw new Error("Google OAuth did not return any credentials")
    }

    const client = getGoogleOAuthClient()
    client.setCredentials(tokens)

    const appUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    const appUserEmail = appUser?.email?.trim().toLowerCase() ?? ""
    const googleIdentity = await getGoogleAccountIdentity(accessToken)
    const connectedGoogleEmail = googleIdentity?.email || appUserEmail
    const connectedGoogleUserId = googleIdentity?.googleUserId || ""

    await prisma.googleConnection.upsert({
      where: { userId },
      update: {
        googleUserId: connectedGoogleUserId,
        email: connectedGoogleEmail,
        accessToken,
        refreshToken,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        updatedAt: new Date(),
      },
      create: {
        userId,
        googleUserId: connectedGoogleUserId,
        email: connectedGoogleEmail,
        accessToken,
        refreshToken,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    })

    const targetUrl = redirectTarget.startsWith("/") ? redirectTarget : "/dashboard"
    const response = NextResponse.redirect(new URL(targetUrl, req.url))
    response.cookies.set("google_oauth_state", "", {
      path: "/",
      expires: new Date(0),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })

    return response
  } catch (error) {
    return createGoogleErrorResponse(error, "Unable to complete Google authorization")
  }
}
