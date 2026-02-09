-- Allow project status 'failed' for when code analysis or processing fails
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('pending', 'processing', 'ready', 'building', 'complete', 'failed'));
