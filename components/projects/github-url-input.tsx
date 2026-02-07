"use client"

import { Check, Github, X } from "lucide-react"
import { useCallback, useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const GITHUB_URL_REGEX = /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/

interface GithubUrlInputProps {
  value: string
  onChange: (value: string) => void
}

function extractRepoName(url: string): string | null {
  const match = url.match(/github\.com\/([\w.-]+\/[\w.-]+)\/?$/)
  return match?.[1] ?? null
}

export function GithubUrlInput({ value, onChange }: GithubUrlInputProps) {
  const [touched, setTouched] = useState(false)

  const isValid = GITHUB_URL_REGEX.test(value)
  const showValidation = touched && value.length > 0
  const repoName = isValid ? extractRepoName(value) : null

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value)
    },
    [onChange]
  )

  return (
    <div className="space-y-2">
      <div className="relative">
        <Github className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={handleChange}
          onBlur={() => setTouched(true)}
          placeholder="https://github.com/owner/repo"
          className={cn(
            "h-9 pl-10 pr-10",
            showValidation && isValid && "border-success",
            showValidation && !isValid && "border-destructive"
          )}
        />
        {showValidation && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isValid ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <X className="h-4 w-4 text-destructive" />
            )}
          </div>
        )}
      </div>
      {repoName && (
        <p className="text-xs text-muted-foreground">
          Repository: <span className="font-medium text-foreground">{repoName}</span>
        </p>
      )}
    </div>
  )
}
