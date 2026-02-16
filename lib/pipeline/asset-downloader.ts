/**
 * Asset download helper for the pipeline.
 *
 * Downloads uploaded project assets from Supabase Storage to a local temp dir.
 * The Right Brain ingestion API accepts `local_files` (local file paths).
 */

import { mkdtemp, writeFile } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { supabase } from "@/lib/db"

/**
 * Download uploaded project assets from Supabase Storage to a local temp directory.
 */
export async function downloadAssetsToLocal(
    projectId: string,
    assets: Array<{ name: string; type: string; storage_path?: string }>
): Promise<string[]> {
    const tempDir = await mkdtemp(join(tmpdir(), `lazarus-${projectId.slice(0, 8)}-`))
    const localPaths: string[] = []

    for (const asset of assets) {
        if (!asset.storage_path) continue
        const bucket = asset.type === "video" ? "project-videos" : "project-documents"

        try {
            const { data, error } = await supabase.storage
                .from(bucket)
                .download(asset.storage_path)

            if (error || !data) {
                console.warn(`[Pipeline] Failed to download ${asset.name}:`, error?.message)
                continue
            }

            const localPath = join(tempDir, asset.name)
            const buffer = Buffer.from(await data.arrayBuffer())
            await writeFile(localPath, buffer)
            localPaths.push(localPath)
            console.log(`[Pipeline] Downloaded ${asset.name} → ${localPath}`)
        } catch (err: unknown) {
            console.warn(`[Pipeline] Download error for ${asset.name}:`, err)
        }
    }

    return localPaths
}
