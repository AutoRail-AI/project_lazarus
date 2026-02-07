import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"

const uploadSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.enum(["video", "document"]),
  contentType: z.string().min(1),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: projectId } = await params

    // Verify project ownership
    const { data: project, error: projectError } = await (supabase as any)
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", session.user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const parsed = uploadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { fileName, fileType, contentType } = parsed.data
    const bucket = fileType === "video" ? "project-videos" : "project-documents"
    const storagePath = `${projectId}/${Date.now()}-${fileName}`

    // Generate presigned upload URL
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(storagePath)

    if (uploadError || !uploadData) {
      return NextResponse.json(
        { error: uploadError?.message || "Failed to generate upload URL" },
        { status: 500 }
      )
    }

    // Create project_assets record
    const { data: asset, error: assetError } = await (supabase as any)
      .from("project_assets")
      .insert({
        project_id: projectId,
        type: fileType,
        name: fileName,
        storage_path: storagePath,
        url: `${bucket}/${storagePath}`,
        processing_status: "pending",
        metadata: { contentType },
      })
      .select()
      .single()

    if (assetError) {
      return NextResponse.json({ error: assetError.message }, { status: 500 })
    }

    return NextResponse.json({
      uploadUrl: uploadData.signedUrl,
      token: uploadData.token,
      asset,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
