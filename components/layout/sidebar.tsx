"use client"

import {
  CreditCard,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  Settings,
  Sparkles,
  User as UserIcon,
  Users,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Logo } from "@/components/branding"
import { OrgSwitcher } from "@/components/layout/org-switcher"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Session } from "@/lib/auth"
import { authClient } from "@/lib/auth/client"
import { cn } from "@/lib/utils"

interface SidebarProps {
  session: Session | null
  hasActiveBuild?: boolean
}

export function Sidebar({ session, hasActiveBuild = false }: SidebarProps) {
  const pathname = usePathname()

  const navItems = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      href: "/dashboard",
      match: (path: string) => path === "/dashboard",
    },
    {
      label: "Projects",
      icon: FolderOpen,
      href: "/projects",
      match: (path: string) => path === "/projects" || (path.startsWith("/projects/") && path !== "/projects/new"),
    },
    {
      label: "Teams",
      icon: Users,
      href: "/teams",
      match: (path: string) => path === "/teams" || path.startsWith("/teams/"),
    },
    {
      label: "Billing",
      icon: CreditCard,
      href: "/billing",
      match: (path: string) => path === "/billing",
    },
    {
      label: "Settings",
      icon: Settings,
      href: "/settings",
      match: (path: string) => path === "/settings",
    },
  ]

  const user = session?.user

  return (
    <aside className="relative flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground overflow-hidden">
      {/* Magic UI-style grid background (subtle high-tech texture) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
        }}
      />
      <div className="relative flex flex-1 flex-col">
        {/* Header / Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <Logo
            variant="on-dark"
            size={32}
            href="/dashboard"
            className="font-grotesk shrink-0"
          />
          {hasActiveBuild && (
            <span
              className="ml-auto h-2 w-2 shrink-0 rounded-full bg-electric-cyan shadow-[0_0_8px_rgba(0,229,255,0.8)] animate-pulse"
              title="Agent activity in progress"
              aria-label="Agent activity in progress"
            />
          )}
        </div>

        <div className="border-b border-sidebar-border px-3 py-3">
          <OrgSwitcher />
        </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = item.match(pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-electric-cyan shadow-glow-cyan"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  isActive ? "text-electric-cyan" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User Section */}
      <div className="border-t border-sidebar-border p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Open user menu"
              className="flex w-full items-center justify-start gap-3 px-2 py-6 hover:bg-sidebar-accent focus-visible:ring-ring"
            >
              <Avatar className="h-8 w-8 rounded-lg border border-sidebar-border">
                <AvatarImage src={user?.image || ""} alt={user?.name || ""} />
                <AvatarFallback className="rounded-lg bg-sidebar-accent font-medium text-sidebar-foreground">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col items-start text-left">
                <span className="truncate text-sm font-medium">
                  {user?.name || "User"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user?.email || ""}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56 border-sidebar-border bg-sidebar text-sidebar-foreground"
            align="end"
            side="right"
            sideOffset={8}
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-sidebar-border" />
            <DropdownMenuItem className="focus:bg-sidebar-accent focus:text-sidebar-foreground">
              <Sparkles className="mr-2 h-4 w-4 text-rail-purple" />
              <span>Upgrade Plan</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="focus:bg-sidebar-accent focus:text-sidebar-foreground">
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-sidebar-border" />
            <DropdownMenuItem
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              onClick={async () => {
                await authClient.signOut()
                window.location.href = "/login"
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      </div>
    </aside>
  )
}
