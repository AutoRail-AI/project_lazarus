-- Pipeline Lifecycle: checkpoints, error context, pause/resume, slice orchestration
-- Adds pipeline state columns to projects table and updates status constraint

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('pending','processing','ready','building','complete','failed','paused'));

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS pipeline_step TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_checkpoint JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS error_context JSONB,
  ADD COLUMN IF NOT EXISTS current_slice_id UUID REFERENCES public.vertical_slices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS build_job_id TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_current_slice ON public.projects(current_slice_id);
