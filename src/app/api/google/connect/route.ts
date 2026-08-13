import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createGoogleErrorResponse, createGoogleState, getGoogleOAuthUrl } from "@/lib/google-auth"

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const state = `${createGoogleState()}:${user.id}`
    const url = getGoogleOAuthUrl(state)

    const baseUrl = new URL(req.url)
    const callbackUrl = `${baseUrl.origin}/api/google/callback`
    const redirect = new URL(url)
    redirect.searchParams.set("redirect_uri", callbackUrl)
    redirect.searchParams.set("state", state)

    const response = NextResponse.json({ redirectUrl: redirect.toString() })
    response.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    })

    await prisma.googleConnection.upsert({
      where: { userId: user.id },
      update: {
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        googleUserId: "",
        email: "",
        accessToken: "",
        refreshToken: "",
      },
    })

    return response
  } catch (error) {
    return createGoogleErrorResponse(error, "Unable to start Google authorization")
  }
}
