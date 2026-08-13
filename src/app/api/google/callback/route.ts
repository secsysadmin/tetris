import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exchangeGoogleCode, getGoogleOAuthClient, createGoogleErrorResponse } from "@/lib/google-auth"
import { google } from "googleapis"

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

  const [, userId] = state.split(":")
  if (!userId) {
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 })
  }

  try {
    const tokens = await exchangeGoogleCode(code)
    const client = getGoogleOAuthClient()
    client.setCredentials(tokens)

    const oauth2 = google.oauth2({
      version: "v2",
      auth: client,
    })
    const profile = await oauth2.userinfo.get()
    const googleUserId = profile.data.id ?? ""
    const googleEmail = profile.data.email ?? ""

    await prisma.googleConnection.upsert({
      where: { userId },
      update: {
        googleUserId,
        email: googleEmail,
        accessToken: tokens.access_token ?? "",
        refreshToken: tokens.refresh_token ?? "",
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        updatedAt: new Date(),
      },
      create: {
        userId,
        googleUserId,
        email: googleEmail,
        accessToken: tokens.access_token ?? "",
        refreshToken: tokens.refresh_token ?? "",
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    })

    const response = NextResponse.redirect(new URL("/dashboard", req.url))
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
