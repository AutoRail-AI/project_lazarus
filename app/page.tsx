import { headers } from "next/headers"
import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Image
              src="/icon.svg"
              alt="Project Lazarus"
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <span className="text-lg font-semibold">Project Lazarus</span>
          </div>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">Get Started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <Image
          src="/autorail.svg"
          alt="Project Lazarus"
          width={120}
          height={120}
          className="mb-6 h-24 w-24"
          priority
        />
        <h1 className="mb-4 text-lg font-semibold">
          Reincarnate{" "}
          <span className="bg-gradient-to-r from-rail-purple to-electric-cyan bg-clip-text text-transparent">
            Legacy Software
          </span>
        </h1>
        <p className="mb-8 max-w-2xl text-sm text-foreground">
          AI-powered autonomous code migration with test-first development and
          self-healing loops. Modernize your legacy systems.
        </p>
        <div className="flex gap-4">
          <Button size="lg" asChild>
            <Link href="/register">Get Started</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <p>
          &copy; {new Date().getFullYear()} Project Lazarus. MIT
          License.
        </p>
      </footer>
    </div>
  )
}
