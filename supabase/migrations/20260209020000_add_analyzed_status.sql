-- Add 'analyzed' to project status CHECK constraint
-- This status represents the checkpoint between brain analysis and slice generation,
-- where the user can review analysis results and configure preferences.

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('pending','processing','analyzed','ready','building','complete','failed','paused'));
