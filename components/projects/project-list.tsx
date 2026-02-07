import { Plus } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Database } from "@/lib/db/types"
import { ProjectCard } from "./project-card"

type Project = Database["public"]["Tables"]["projects"]["Row"]

interface ProjectListProps {
  projects: Project[]
}

export function ProjectList({ projects }: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <Card className="glass-panel border-dashed border-border bg-card/30">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-rail-purple/10 p-4 mb-4">
            <Plus className="h-8 w-8 text-rail-purple" />
          </div>
          <h3 className="text-lg font-semibold font-grotesk text-foreground mb-2">No projects yet</h3>
          <p className="text-sm text-foreground max-w-sm mb-6">
            Create your first migration project to start transmuting legacy code into modern applications.
          </p>
          <Button asChild size="sm" className="bg-rail-fade hover:opacity-90 transition-opacity shadow-glow-purple">
            <Link href="/projects/new">
              <Plus className="mr-2 h-3.5 w-3.5" aria-hidden />
              Create Project
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )
}
