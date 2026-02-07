import type { Metadata } from "next"
import { OAuthButtons, RegisterForm } from "@/components/auth"

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create a new account",
}

export default function RegisterPage() {
  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="space-y-0.5 text-center">
        <h1 className="text-lg font-semibold">Create an account</h1>
        <p className="mt-0.5 text-sm text-foreground">
          Get started today
        </p>
      </div>

      <div className="space-y-4">
        <OAuthButtons mode="register" />
        <RegisterForm />
      </div>
    </div>
  )
}
