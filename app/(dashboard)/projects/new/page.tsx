"use client"

import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, ArrowRight, Check, CheckCircle2, FileText, FileVideo, Github, Sparkles } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { GithubUrlInput } from "@/components/projects/github-url-input"
import { UploadZone } from "@/components/projects/upload-zone"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const STEPS = [
  { label: "Basics", icon: CheckCircle2, description: "Project details & framework" },
  { label: "Assets", icon: FileVideo, description: "Videos & documentation" },
  { label: "Source Code", icon: Github, description: "Repository URL (optional)" },
  { label: "Review", icon: Sparkles, description: "Verify & launch" },
] as const

const FRAMEWORKS = [
  { value: "nextjs", label: "Next.js", comingSoon: false },
  { value: "react", label: "React", comingSoon: true },
  { value: "vue", label: "Vue", comingSoon: true },
  { value: "angular", label: "Angular", comingSoon: true },
  { value: "svelte", label: "Svelte", comingSoon: true },
  { value: "other", label: "Other", comingSoon: true },
]

const GITHUB_URL_REGEX = /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/

export default function NewProjectPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [direction, setDirection] = useState(0)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [targetFramework, setTargetFramework] = useState("nextjs")
  const [githubUrl, setGithubUrl] = useState("")
  const [videoFiles, setVideoFiles] = useState<File[]>([])
  const [documentFiles, setDocumentFiles] = useState<File[]>([])

  const currentStep = STEPS[step]
  const CurrentIcon = currentStep?.icon

  const hasValidGithubUrl = githubUrl.trim().length > 0 && GITHUB_URL_REGEX.test(githubUrl.trim())
  const hasFiles = videoFiles.length > 0 || documentFiles.length > 0
  const hasAtLeastOneSource = hasValidGithubUrl || hasFiles

  const canProceed = () => {
    if (step === 0) return name.trim().length > 0
    if (step === 1) return true // Assets step — always can proceed
    if (step === 2) return !githubUrl.trim() || GITHUB_URL_REGEX.test(githubUrl.trim())
    return true
  }

  const handleNext = () => {
    if (step < STEPS.length - 1 && canProceed()) {
      setDirection(1)
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 0) {
      setDirection(-1)
      setStep(step - 1)
    }
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
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
        ...(token ? { "x-upsert": "true" } : {}),
      },
      body: file,
    })

    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => "Unknown error")
      throw new Error(`Failed to upload ${file.name}: ${errText.slice(0, 200)}`)
    }
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
        const err = (await createRes.json()) as { error?: string; upgrade?: boolean }

        // Quota limit reached: show upgrade prompt
        if (createRes.status === 403 && err.upgrade) {
          toast.error(err.error ?? "Project limit reached", {
            description: "Upgrade to Pro for unlimited projects.",
            action: {
              label: "Upgrade",
              onClick: () => window.location.assign("/billing"),
            },
            duration: 8000,
          })
          setIsSubmitting(false)
          return
        }

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
        const processErr = (await processRes.json()) as { error?: string }
        toast.error(processErr.error || "Project created but processing failed to start. You can retry from the project page.")
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

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 20 : -20,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 20 : -20,
      opacity: 0,
    }),
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-grotesk text-3xl font-bold tracking-tight">New Project</h1>
          <p className="text-muted-foreground">
            Transform your legacy application into modern architecture
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link href="/projects">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Link>
        </Button>
      </div>

      {/* Stepper */}
      <div className="relative flex justify-between">
        <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-muted" />
        <div
          className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-primary transition-all duration-500 ease-in-out"
          style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
        />
        {STEPS.map((s, i) => {
          const isCompleted = i < step
          const isCurrent = i === step
          const Icon = s.icon

          return (
            <div key={s.label} className="relative z-10 flex flex-col items-center gap-2">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                  isCompleted
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCurrent
                      ? "border-primary bg-background text-primary shadow-[0_0_0_4px_rgba(var(--primary),0.2)]"
                      : "border-muted bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <div className="absolute top-12 w-32 text-center">
                <span
                  className={cn(
                    "block text-sm font-medium transition-colors",
                    isCurrent ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {s.label}
                </span>
                <span className="hidden text-xs text-muted-foreground sm:block">{s.description}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Content */}
      <div className="mt-12 pt-8">
        <Card className="glass-card overflow-hidden border-muted/40 shadow-xl">
          <CardHeader className="border-b border-border/50 bg-muted/20 px-8 py-6">
            <CardTitle className="flex items-center gap-2 text-xl">
              {CurrentIcon && <CurrentIcon className="h-5 w-5 text-primary" />}
              {currentStep?.label}
            </CardTitle>
            <CardDescription>{currentStep?.description}</CardDescription>
          </CardHeader>

          <CardContent className="p-8">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="min-h-[300px]"
              >
                {/* Step 0: Basics */}
                {step === 0 && (
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4 md:col-span-2">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-base">Project Name <span className="text-destructive">*</span></Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Legacy CRM Migration"
                          className="h-11 text-lg"
                          autoFocus
                        />
                        <p className="text-xs text-muted-foreground">
                          A unique name to identify your migration project.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="framework">Target Framework</Label>
                        <Select value={targetFramework} onValueChange={setTargetFramework}>
                          <SelectTrigger id="framework" className="h-11">
                            <SelectValue placeholder="Select framework" />
                          </SelectTrigger>
                          <SelectContent>
                            {FRAMEWORKS.map((fw) => (
                              <SelectItem
                                key={fw.value}
                                value={fw.value}
                                disabled={fw.comingSoon}
                              >
                                {fw.label}
                                {fw.comingSoon ? " — Coming soon" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          The modern stack you want to migrate to.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 md:col-span-2">
                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Briefly describe the legacy application's purpose and key features..."
                          rows={4}
                          className="resize-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 1: Assets */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">At least one source required.</span> Upload screen recordings and documentation to power the behavioral analysis. You can also provide a GitHub URL in the next step.
                      </p>
                    </div>
                    <div className="grid gap-8 md:grid-cols-2">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2 text-base">
                            <FileVideo className="h-4 w-4 text-primary" />
                            Video Walkthroughs
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Upload screen recordings showing key workflows.
                          </p>
                        </div>
                        <UploadZone
                          type="video"
                          files={videoFiles}
                          onFilesChange={setVideoFiles}
                          maxFiles={3}
                        />
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2 text-base">
                            <FileText className="h-4 w-4 text-primary" />
                            Documentation
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Specs, architecture diagrams, or notes.
                          </p>
                        </div>
                        <UploadZone
                          type="document"
                          files={documentFiles}
                          onFilesChange={setDocumentFiles}
                          maxFiles={5}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Source Code */}
                {step === 2 && (
                  <div className="space-y-6">
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <h3 className="mb-2 flex items-center gap-2 font-medium text-primary">
                        <Github className="h-4 w-4" />
                        GitHub Repository (Optional)
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Connect your legacy codebase to analyze structure and dependencies. You can skip this if you uploaded videos/docs in the previous step.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Repository URL</Label>
                        <GithubUrlInput value={githubUrl} onChange={setGithubUrl} />
                        <p className="text-xs text-muted-foreground">
                          Example: https://github.com/organization/legacy-app. Leave empty if you prefer to use uploaded files only.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Review */}
                {step === 3 && (
                  <div className="space-y-6">
                    {!hasAtLeastOneSource && (
                      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                        <p className="text-sm text-destructive font-medium">
                          At least one source is required. Add a GitHub repository URL or upload at least one video or document, then use Back to update.
                        </p>
                      </div>
                    )}
                    <div className="rounded-lg border bg-card p-6 shadow-sm">
                      <h3 className="mb-4 text-lg font-medium">Project Summary</h3>
                      <dl className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                          <dt className="text-sm font-medium text-muted-foreground">Project Name</dt>
                          <dd className="text-base font-medium">{name}</dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-sm font-medium text-muted-foreground">Target Framework</dt>
                          <dd className="text-base font-medium text-primary">
                            {FRAMEWORKS.find((f) => f.value === targetFramework)?.label}
                          </dd>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <dt className="text-sm font-medium text-muted-foreground">Description</dt>
                          <dd className="text-sm text-foreground/80">{description || "No description provided"}</dd>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <dt className="text-sm font-medium text-muted-foreground">Repository</dt>
                          <dd className="break-all font-mono text-sm text-muted-foreground">
                            {githubUrl || "No repository connected"}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg border bg-muted/30 p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <FileVideo className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{videoFiles.length} Videos</p>
                            <p className="text-xs text-muted-foreground">Ready for analysis</p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{documentFiles.length} Documents</p>
                            <p className="text-xs text-muted-foreground">Ready for indexing</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </CardContent>

          <CardFooter className="flex justify-between border-t border-border/50 bg-muted/20 px-8 py-6">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 0 || isSubmitting}
              className="w-24"
            >
              Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                className="w-24 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !name.trim() || !hasAtLeastOneSource}
                className="min-w-[180px] bg-linear-to-r from-rail-purple to-electric-cyan text-white shadow-glow-purple transition-all hover:opacity-90 hover:shadow-glow-cyan"
              >
                {isSubmitting ? (
                  <>
                    <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Begin Transmutation
                  </>
                )}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
