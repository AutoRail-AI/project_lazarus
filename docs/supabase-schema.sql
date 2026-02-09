-- Project Lazarus — Supabase PostgreSQL Schema (reference only)
-- Executable migrations live in supabase/migrations/ and are applied by: pnpm migrate
-- pnpm dev runs migrate automatically (predev). Do not run this file manually.
--
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects Table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id TEXT, -- Can be null for personal projects
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  github_url TEXT,
  target_framework TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'building', 'complete', 'failed', 'paused')),
  left_brain_status TEXT,
  right_brain_status TEXT,
  confidence_score FLOAT DEFAULT 0,
  metadata JSONB,
  pipeline_step TEXT,                -- Current step in the pipeline (left_brain, right_brain, planning, slice:<id>)
  pipeline_checkpoint JSONB DEFAULT '{}', -- Checkpoint state for resume (completed_steps, cached results)
  error_context JSONB,               -- Structured error info (step, message, retryable, stack)
  current_slice_id UUID REFERENCES vertical_slices(id) ON DELETE SET NULL, -- Currently building slice
  build_job_id TEXT,                  -- BullMQ job ID for cancellation
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project Assets Table
CREATE TABLE project_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('video', 'document', 'repo', 'screenshot')),
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  processing_status TEXT DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vertical Slices Table
CREATE TABLE vertical_slices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
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

-- Agent Events Table (Real-time stream)
CREATE TABLE agent_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  slice_id UUID REFERENCES vertical_slices(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('thought', 'tool_call', 'observation', 'code_write', 'test_run', 'test_result', 'self_heal', 'confidence_update')),
  content TEXT NOT NULL,
  metadata JSONB,
  confidence_delta FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions Table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  org_id TEXT,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_price_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('free', 'pro', 'enterprise')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities Table
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  organization_id TEXT NOT NULL,
  type TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs Table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  organization_id TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage Table
CREATE TABLE usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  organization_id TEXT,
  api_key_id TEXT,
  type TEXT NOT NULL,
  resource TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  cost FLOAT,
  metadata JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhooks Table
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Keys Table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  organization_id TEXT,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE, -- Hashed key
  key_prefix TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL,
  rate_limit JSONB,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature Flags Table
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  rollout_percentage INTEGER DEFAULT 100,
  target_users TEXT[],
  target_organizations TEXT[],
  environments TEXT[] DEFAULT ARRAY['production'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  organization_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error', 'invitation', 'mention')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Onboarding Table
CREATE TABLE onboarding (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL UNIQUE,
  completed_steps TEXT[],
  current_step TEXT DEFAULT 'welcome',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate Limits Table
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  count INTEGER DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Search Index Table
CREATE TABLE search_index (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT,
  resource TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resource, resource_id)
);

-- Templates Table
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  organization_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('prompt', 'workflow', 'agent', 'form')),
  category TEXT,
  tags TEXT[],
  content JSONB NOT NULL,
  variables JSONB,
  public BOOLEAN DEFAULT FALSE,
  featured BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_org ON projects(org_id);
CREATE INDEX idx_projects_current_slice ON projects(current_slice_id);
CREATE INDEX idx_project_assets_project ON project_assets(project_id);
CREATE INDEX idx_slices_project ON vertical_slices(project_id);
CREATE INDEX idx_agent_events_project ON agent_events(project_id);
CREATE INDEX idx_agent_events_slice ON agent_events(slice_id);
CREATE INDEX idx_agent_events_created ON agent_events(project_id, created_at DESC);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_activities_org ON activities(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_usage_user ON usage(user_id, timestamp DESC);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);
CREATE INDEX idx_search_index_text ON search_index USING GIN (to_tsvector('english', title || ' ' || content));
CREATE INDEX idx_templates_public ON templates(public, featured, usage_count DESC);

-- Auto-update updated_at function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_vertical_slices_updated_at BEFORE UPDATE ON vertical_slices FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON feature_flags FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_onboarding_updated_at BEFORE UPDATE ON onboarding FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_search_index_updated_at BEFORE UPDATE ON search_index FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE agent_events;
ALTER PUBLICATION supabase_realtime ADD TABLE vertical_slices;
