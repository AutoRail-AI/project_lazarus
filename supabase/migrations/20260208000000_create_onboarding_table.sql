-- Onboarding table for user onboarding flow (welcome → profile → organization → preferences → complete)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.onboarding (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL UNIQUE,
  completed_steps TEXT[] DEFAULT '{}',
  current_step TEXT DEFAULT 'welcome',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_user ON public.onboarding(user_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_onboarding_updated_at ON public.onboarding;
CREATE TRIGGER update_onboarding_updated_at
  BEFORE UPDATE ON public.onboarding
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
