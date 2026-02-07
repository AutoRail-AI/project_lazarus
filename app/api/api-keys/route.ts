import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "@/lib/api-keys/manager"
import { auth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const organizationId = searchParams.get("organizationId") || undefined

  const keys = await listApiKeys(session.user.id, organizationId)

  // Don't expose full keys, only prefixes
  return NextResponse.json(
    keys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.key_prefix,
      lastUsedAt: key.last_used_at,
      expiresAt: key.expires_at,
      scopes: key.scopes,
      enabled: key.enabled,
      createdAt: key.created_at,
    }))
  )
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json()) as {
    name?: string
    organizationId?: string
    scopes?: string[]
    expiresAt?: string
    rateLimit?: { requests: number; windowMs: number }
  }
  const { name, organizationId, scopes, expiresAt, rateLimit } = body

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const { apiKey, plainKey } = await createApiKey(session.user.id, name, {
    organizationId,
    scopes,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    rateLimit,
  })

  // Return plain key only once (user should save it)
  return NextResponse.json({
    id: apiKey.id,
    name: apiKey.name,
    key: plainKey, // Only returned once
    keyPrefix: apiKey.key_prefix,
    scopes: apiKey.scopes,
    expiresAt: apiKey.expires_at,
    createdAt: apiKey.created_at,
  })
}

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const keyId = searchParams.get("id")

  if (!keyId) {
    return NextResponse.json({ error: "Key ID is required" }, { status: 400 })
  }

  await revokeApiKey(keyId, session.user.id)

  return NextResponse.json({ success: true })
}

