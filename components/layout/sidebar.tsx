"use client"

import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
  User as UserIcon,
  Users,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Session } from "@/lib/auth"
import { authClient } from "@/lib/auth/client"
import { cn } from "@/lib/utils"

interface SidebarProps {
  session: Session | null
  hasActiveBuild?: boolean
}

export function Sidebar({ session, hasActiveBuild = false }: SidebarProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Initialize from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved) {
      setIsCollapsed(saved === "true")
    }
  }, [])

  // Handle responsive behavior and persistence
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
      if (window.innerWidth < 1024) {
        setIsCollapsed(true)
      }
    }
    
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem("sidebar-collapsed", String(newState))
  }

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
    <TooltipProvider delayDuration={0}>
      <aside 
        className={cn(
          "relative flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Magic UI-style grid background (subtle high-tech texture) */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)`,
            backgroundSize: "20px 20px",
          }}
        />
        
        {/* Collapse Toggle Button */}
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute -right-3 top-6 z-20 h-6 w-6 rounded-full border border-sidebar-border bg-sidebar text-muted-foreground shadow-sm hover:bg-sidebar-accent hover:text-foreground"
            onClick={toggleCollapse}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronLeft className="h-3 w-3" />
            )}
          </Button>
        )}

        <div className="relative flex flex-1 flex-col overflow-hidden">
          {/* Header / Logo */}
          <div className={cn(
            "flex h-16 items-center border-b border-sidebar-border transition-all duration-300",
            isCollapsed ? "justify-center px-2" : "gap-3 px-4"
          )}>
            <Logo
              variant="on-dark"
              size={32}
              href="/dashboard"
              showText={!isCollapsed}
              className="font-grotesk shrink-0"
            />
            {!isCollapsed && hasActiveBuild && (
              <span
                className="ml-auto h-2 w-2 shrink-0 rounded-full bg-electric-cyan shadow-[0_0_8px_rgba(0,229,255,0.8)] animate-pulse"
                title="Agent activity in progress"
                aria-label="Agent activity in progress"
              />
            )}
          </div>

          <div className={cn(
            "border-b border-sidebar-border transition-all duration-300",
            isCollapsed ? "p-2" : "px-3 py-3"
          )}>
            {isCollapsed ? (
              <div className="flex justify-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Switch Organization</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <OrgSwitcher />
            )}
          </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navItems.map((item) => {
            const isActive = item.match(pathname)
            
            if (isCollapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-md transition-all duration-200 mx-auto",
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
                      <span className="sr-only">{item.label}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              )
            }

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
        <div className="border-t border-sidebar-border p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size={isCollapsed ? "icon" : "sm"}
                aria-label="Open user menu"
                className={cn(
                  "flex w-full items-center hover:bg-sidebar-accent focus-visible:ring-ring",
                  isCollapsed ? "justify-center h-9 w-9" : "justify-start gap-3 px-2 py-6"
                )}
              >
                <Avatar className="h-8 w-8 rounded-lg border border-sidebar-border">
                  <AvatarImage src={user?.image || ""} alt={user?.name || ""} />
                  <AvatarFallback className="rounded-lg bg-sidebar-accent font-medium text-sidebar-foreground">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="flex flex-1 flex-col items-start text-left overflow-hidden">
                    <span className="truncate text-sm font-medium w-full">
                      {user?.name || "User"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground w-full">
                      {user?.email || ""}
                    </span>
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 border-sidebar-border bg-sidebar text-sidebar-foreground"
              align={isCollapsed ? "center" : "end"}
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
    </TooltipProvider>
  )
}
