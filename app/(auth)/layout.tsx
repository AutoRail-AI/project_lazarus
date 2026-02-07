import { Logo } from "@/components/branding"
import { APP_NAME } from "@/lib/utils/constants"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding (Rail Fade gradient) */}
      <div className="hidden lg:flex lg:w-1/2 bg-rail-fade relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-white/10 to-transparent opacity-50" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <Logo
              variant="on-brand"
              size={40}
              href="/"
              iconWrapperClassName="rounded-xl bg-white/10 p-2 shadow-lg backdrop-blur-sm ring-1 ring-white/20"
              className="drop-shadow-md"
            />
          </div>

          <div className="space-y-6">
            <blockquote className="text-xl font-medium leading-relaxed">
              &ldquo;A production-ready Next.js starter with everything you need
              to build modern web applications.&rdquo;
            </blockquote>
            <div className="flex items-center space-x-4">
              <div className="h-px flex-1 bg-white/30" />
              <span className="text-sm text-white/70">
                Start building faster
              </span>
              <div className="h-px flex-1 bg-white/30" />
            </div>
          </div>

          <div className="text-sm text-white/60">
            &copy; {new Date().getFullYear()} {APP_NAME}. MIT License.
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/5 rounded-full" />
      </div>

      {/* Right side - Auth forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo (Void Black background) */}
          <div className="lg:hidden text-center">
            <Logo variant="on-dark" size={32} href="/" />
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
