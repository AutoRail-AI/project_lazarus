import type { Metadata } from "next"
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google"
import { Providers } from "@/components/providers"
import "styles/tailwind.css"

// Heading font: Space Grotesk (Semi Bold for headings)
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
})

// Body font: Inter
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter-var",
  display: "swap",
})

// Mono font: JetBrains Mono (code blocks)
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Project Lazarus - Reincarnate Legacy Software",
    template: "%s | Project Lazarus",
  },
  description:
    "Project Lazarus transmutes legacy software into modern web applications using AI agents with test-first development and self-healing loops.",
  keywords: [
    "legacy migration",
    "software modernization",
    "AI agents",
    "code generation",
    "Next.js",
    "automated testing",
  ],
  authors: [{ name: "Project Lazarus" }],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
