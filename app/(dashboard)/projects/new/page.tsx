"use client"

import { ArrowLeft, ArrowRight, CheckCircle2, FileText, FileVideo, Github, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { GithubUrlInput } from "@/components/projects/github-url-input"
import { UploadZone } from "@/components/projects/upload-zone"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const STEPS = [
  { label: "Basics", icon: CheckCircle2 },
  { label: "Source Code", icon: Github },
  { label: "Assets", icon: FileVideo },
  { label: "Review", icon: Sparkles },
] as const

const FRAMEWORKS = [
  { value: "nextjs", label: "Next.js" },
  { value: "react", label: "React" },
  { value: "vue", label: "Vue" },
  { value: "angular", label: "Angular" },
  { value: "svelte", label: "Svelte" },
  { value: "other", label: "Other" },
]

const GITHUB_URL_REGEX = /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/

export default function NewProjectPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [targetFramework, setTargetFramework] = useState("nextjs")
  const [githubUrl, setGithubUrl] = useState("")
  const [videoFiles, setVideoFiles] = useState<File[]>([])
  const [documentFiles, setDocumentFiles] = useState<File[]>([])

  const canProceed = () => {
    if (step === 0) return name.trim().length > 0
    if (step === 1) return !githubUrl || GITHUB_URL_REGEX.test(githubUrl)
    return true
  }

  const handleNext = () => {
    if (step < STEPS.length - 1 && canProceed()) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 0) setStep(step - 1)
  }

  const uploadFile = async (projectId: string, file: File, fileType: "video" | "document") => {
    // Get presigned URL
    const res = await fetch(`/api/projects/${projectId}/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        fileType,
        contentType: file.type,
      }),
    })

    if (!res.ok) throw new Error("Failed to get upload URL")

    const { uploadUrl, token } = (await res.json()) as { uploadUrl: string; token: string }

    // Upload directly to Supabase Storage
    await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
        ...(token ? { "x-upsert": "true" } : {}),
      },
      body: file,
    })
  }

  const handleSubmit = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      // 1. Create the project
      const createRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          githubUrl: githubUrl.trim() || undefined,
          targetFramework,
        }),
      })

      if (!createRes.ok) {
        const err = (await createRes.json()) as { error?: string }
        throw new Error(err.error || "Failed to create project")
      }

      const project = (await createRes.json()) as { id: string }

      // 2. Upload files
      const allUploads = [
        ...videoFiles.map((f) => uploadFile(project.id, f, "video")),
        ...documentFiles.map((f) => uploadFile(project.id, f, "document")),
      ]

      if (allUploads.length > 0) {
        await Promise.all(allUploads)
      }

      // 3. Trigger processing
      const processRes = await fetch(`/api/projects/${project.id}/process`, {
        method: "POST",
      })

      if (!processRes.ok) {
        toast.error("Project created but processing failed to start. You can retry from the project page.")
      } else {
        toast.success("Project created! Analysis is starting...")
      }

      // 4. Navigate to project
      router.push(`/projects/${project.id}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong"
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const progressPercent = ((step + 1) / STEPS.length) * 100

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-grotesk text-2xl font-bold">New Project</h1>
        <p className="text-sm text-muted-foreground">
          Set up your legacy migration project
        </p>
      </div>

      {/* Step indicators */}
      <div className="space-y-2">
        <div className="flex justify-between">
          {STEPS.map((s, i) => (
            <button
              key={s.label}
              onClick={() => i < step && setStep(i)}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium transition-colors",
                i === step
                  ? "text-electric-cyan"
                  : i < step
                    ? "cursor-pointer text-foreground hover:text-electric-cyan"
                    : "text-muted-foreground"
              )}
            >
              <s.icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          ))}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rail-purple to-electric-cyan transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          {/* Step 0: Basics */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Legacy App"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the legacy application..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="framework">Target Framework</Label>
                <select
                  id="framework"
                  value={targetFramework}
                  onChange={(e) => setTargetFramework(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {FRAMEWORKS.map((fw) => (
                    <option key={fw.value} value={fw.value}>
                      {fw.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 1: Source Code */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>GitHub Repository URL</Label>
                <p className="text-xs text-muted-foreground">
                  Provide the URL of the legacy codebase you want to migrate
                </p>
                <GithubUrlInput value={githubUrl} onChange={setGithubUrl} />
              </div>
            </div>
          )}

          {/* Step 2: Assets */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileVideo className="h-4 w-4" />
                  Video Walkthroughs
                </Label>
                <p className="text-xs text-muted-foreground">
                  Upload screen recordings showing how the legacy app works
                </p>
                <UploadZone
                  type="video"
                  files={videoFiles}
                  onFilesChange={setVideoFiles}
                  maxFiles={3}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documentation
                </Label>
                <p className="text-xs text-muted-foreground">
                  Upload any existing documentation, specs, or notes
                </p>
                <UploadZone
                  type="document"
                  files={documentFiles}
                  onFilesChange={setDocumentFiles}
                  maxFiles={5}
                />
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-grotesk text-lg font-semibold">Review & Launch</h3>
              <div className="space-y-3 rounded-lg border border-border bg-card/50 p-4">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Name</span>
                  <span className="text-sm font-medium">{name}</span>
                </div>
                {description && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Description</span>
                    <span className="max-w-[60%] text-right text-sm">{description}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Framework</span>
                  <span className="text-sm font-medium">
                    {FRAMEWORKS.find((f) => f.value === targetFramework)?.label}
                  </span>
                </div>
                {githubUrl && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Repository</span>
                    <span className="text-sm font-medium text-electric-cyan">{githubUrl}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Videos</span>
                  <span className="text-sm">{videoFiles.length} file(s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Documents</span>
                  <span className="text-sm">{documentFiles.length} file(s)</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 0}
          size="sm"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext} disabled={!canProceed()} size="sm">
            Next
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
            className="bg-gradient-to-r from-rail-purple to-electric-cyan text-white hover:opacity-90"
            size="sm"
          >
            {isSubmitting ? (
              "Creating..."
            ) : (
              <>
                <Sparkles className="mr-1 h-4 w-4" />
                Begin Transmutation
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
