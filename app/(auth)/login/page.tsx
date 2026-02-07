import type { Metadata } from "next"
import { Suspense } from "react"
import { LoginForm, OAuthButtons } from "@/components/auth"

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your account",
}

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="space-y-0.5 text-center">
        <h1 className="text-lg font-semibold">Welcome back</h1>
        <p className="mt-0.5 text-sm text-foreground">
          Sign in to your account to continue
        </p>
      </div>

      <div className="space-y-4">
        <OAuthButtons mode="login" />
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
