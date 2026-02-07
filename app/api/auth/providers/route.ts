import { NextResponse } from "next/server"

/**
 * Returns which OAuth providers are configured.
 * Used by the client to conditionally show OAuth buttons.
 */
export async function GET() {
  const googleEnabled =
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET

  return NextResponse.json({
    google: googleEnabled,
  })
}
