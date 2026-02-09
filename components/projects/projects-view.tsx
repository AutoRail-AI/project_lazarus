"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Plus, Search, LayoutGrid, List as ListIcon, Filter } from "lucide-react"
import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProjectCard } from "@/components/projects/project-card"
import { BreathingGlow } from "@/components/ai/glass-brain/ambient-effects"
import type { Database } from "@/lib/db/types"
import { Card, CardContent } from "@/components/ui/card"

type Project = Database["public"]["Tables"]["projects"]["Row"]

interface ProjectsViewProps {
  projects: Project[]
}

export function ProjectsView({ projects }: ProjectsViewProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch = project.name.toLowerCase().includes(search.toLowerCase()) ||
        (project.description?.toLowerCase().includes(search.toLowerCase()) ?? false)

      if (!matchesSearch) return false

      if (statusFilter === "all") return true
      if (statusFilter === "active") {
        return ["processing", "building", "ready", "pending"].includes(project.status)
      }
      if (statusFilter === "completed") {
        return project.status === "complete"
      }
      if (statusFilter === "failed") {
        return project.status === "failed" || project.status === "paused"
      }
      return true
    })
  }, [projects, search, statusFilter])

  // Calculate average confidence for the glow effect
  const averageConfidence = useMemo(() => {
    if (projects.length === 0) return 0
    const sum = projects.reduce((acc, p) => acc + (p.confidence_score || 0), 0)
    return sum / projects.length
  }, [projects])

  return (
    <BreathingGlow confidence={averageConfidence} className="flex flex-col h-full p-6 gap-6">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="space-y-1">
          <h1 className="font-grotesk text-2xl font-semibold text-foreground tracking-tight">
            Projects
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your legacy code migration projects.
          </p>
        </div>
        <Button asChild size="sm" className="bg-rail-fade hover:opacity-90 transition-opacity shadow-glow-purple">
          <Link href="/projects/new">
            <Plus className="mr-2 h-3.5 w-3.5" />
            New Project
          </Link>
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shrink-0 glass-panel p-4 rounded-lg bg-card/20 border-border/50">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            className="pl-9 bg-background/50 border-border/50 focus:border-electric-cyan/50 transition-colors"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
          <TabsList className="bg-background/50 border border-border/50">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="failed">Issues</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Projects Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
        {filteredProjects.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full flex flex-col items-center justify-center"
          >
            <Card className="glass-panel border-dashed border-border bg-card/30 max-w-md w-full">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-rail-purple/10 p-4 mb-4">
                  <Plus className="h-8 w-8 text-rail-purple" />
                </div>
                <h3 className="text-lg font-semibold font-grotesk text-foreground mb-2">
                  {projects.length === 0 ? "No projects yet" : "No matching projects"}
                </h3>
                <p className="text-sm text-foreground max-w-sm mb-6">
                  {projects.length === 0 
                    ? "Create your first migration project to start transmuting legacy code into modern applications."
                    : "Try adjusting your search or filters to find what you're looking for."}
                </p>
                {projects.length === 0 && (
                  <Button asChild size="sm" className="bg-rail-fade hover:opacity-90 transition-opacity shadow-glow-purple">
                    <Link href="/projects/new">
                      <Plus className="mr-2 h-3.5 w-3.5" aria-hidden />
                      Create Project
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-6">
            {filteredProjects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <ProjectCard project={project} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </BreathingGlow>
  )
}
