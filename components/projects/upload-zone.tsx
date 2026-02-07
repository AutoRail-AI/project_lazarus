"use client"

import { FileText, FileVideo, Upload, X } from "lucide-react"
import { useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ACCEPT_MAP = {
  video: {
    "video/mp4": [".mp4"],
    "video/quicktime": [".mov"],
    "video/webm": [".webm"],
    "video/x-msvideo": [".avi"],
  },
  document: {
    "application/pdf": [".pdf"],
    "text/markdown": [".md"],
    "text/plain": [".txt"],
  },
} as const

interface UploadZoneProps {
  type: "video" | "document"
  files: File[]
  onFilesChange: (files: File[]) => void
  maxFiles?: number
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function UploadZone({ type, files, onFilesChange, maxFiles = 5 }: UploadZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles = [...files, ...acceptedFiles].slice(0, maxFiles)
      onFilesChange(newFiles)
    },
    [files, onFilesChange, maxFiles]
  )

  const removeFile = useCallback(
    (index: number) => {
      const newFiles = files.filter((_, i) => i !== index)
      onFilesChange(newFiles)
    },
    [files, onFilesChange]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT_MAP[type],
    maxFiles: maxFiles - files.length,
    disabled: files.length >= maxFiles,
  })

  const FileIcon = type === "video" ? FileVideo : FileText
  const label = type === "video" ? "videos" : "documents"
  const extensions =
    type === "video" ? ".mp4, .mov, .webm, .avi" : ".pdf, .md, .txt"

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
          isDragActive
            ? "border-electric-cyan bg-electric-cyan/5"
            : "border-border hover:border-muted-foreground/50",
          files.length >= maxFiles && "cursor-not-allowed opacity-50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isDragActive
            ? `Drop your ${label} here...`
            : `Drag & drop ${label}, or click to browse`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Accepts {extensions} (max {maxFiles} files)
        </p>
      </div>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 rounded-md border border-border bg-card/50 px-3 py-2"
            >
              <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm">{file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  removeFile(index)
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
