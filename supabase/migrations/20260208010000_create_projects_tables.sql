-- Projects, project_assets, vertical_slices, agent_events for project creation wizard
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id TEXT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  github_url TEXT,
  target_framework TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'building', 'complete')),
  left_brain_status TEXT,
  right_brain_status TEXT,
  confidence_score FLOAT DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_org ON public.projects(org_id);

-- Project Assets Table
CREATE TABLE IF NOT EXISTS public.project_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('video', 'document', 'repo', 'screenshot')),
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  processing_status TEXT DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_assets_project ON public.project_assets(project_id);

-- Vertical Slices Table
CREATE TABLE IF NOT EXISTS public.vertical_slices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'selected', 'building', 'testing', 'self_healing', 'complete', 'failed')),
  behavioral_contract JSONB,
  code_contract JSONB,
  modernization_flags JSONB,
  dependencies UUID[],
  test_results JSONB,
  confidence_score FLOAT DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slices_project ON public.vertical_slices(project_id);

-- Agent Events Table
CREATE TABLE IF NOT EXISTS public.agent_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  slice_id UUID REFERENCES public.vertical_slices(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('thought', 'tool_call', 'observation', 'code_write', 'test_run', 'test_result', 'self_heal', 'confidence_update')),
  content TEXT NOT NULL,
  metadata JSONB,
  confidence_delta FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_events_project ON public.agent_events(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_slice ON public.agent_events(slice_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_created ON public.agent_events(project_id, created_at DESC);

-- Triggers for updated_at (reuse function from onboarding migration if exists)
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_vertical_slices_updated_at ON public.vertical_slices;
CREATE TRIGGER update_vertical_slices_updated_at
  BEFORE UPDATE ON public.vertical_slices
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
