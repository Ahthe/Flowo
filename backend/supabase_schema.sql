-- ============================================================
-- Flowo Database Schema
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  skill_level TEXT DEFAULT 'intermediate',
  priority TEXT DEFAULT 'medium',
  deadline TIMESTAMPTZ,
  estimated_time TEXT DEFAULT '30m',
  status TEXT DEFAULT 'idle',
  total_time_seconds INTEGER DEFAULT 0,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  predicted_satisfaction INTEGER,
  actual_satisfaction INTEGER,
  pursuit_id UUID,
  contribution_type TEXT,
  effort_size TEXT DEFAULT 'medium',
  xp_value INTEGER DEFAULT 25,
  completed_at TIMESTAMPTZ,
  target_sessions_per_day INTEGER DEFAULT 1,
  min_spacing_minutes INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Pursuits table
CREATE TABLE IF NOT EXISTS pursuits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  why TEXT DEFAULT '',
  target TEXT DEFAULT '',
  weekly_focus TEXT DEFAULT '',
  weekly_target_xp INTEGER DEFAULT 150,
  category TEXT DEFAULT 'personal',
  deadline TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  color TEXT DEFAULT 'yellow',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Journal entries table
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'thought',
  title TEXT DEFAULT '',
  body TEXT DEFAULT '',
  mood TEXT DEFAULT '',
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  pursuit_id UUID REFERENCES pursuits(id) ON DELETE SET NULL,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  training_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safe migration columns for existing Supabase projects
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pursuit_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS contribution_type TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS effort_size TEXT DEFAULT 'medium';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS xp_value INTEGER DEFAULT 25;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE pursuits ADD COLUMN IF NOT EXISTS weekly_focus TEXT DEFAULT '';
ALTER TABLE pursuits ADD COLUMN IF NOT EXISTS weekly_target_xp INTEGER DEFAULT 150;

ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS pursuit_id UUID;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS training_data JSONB;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tasks_pursuit'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT fk_tasks_pursuit
      FOREIGN KEY (pursuit_id) REFERENCES pursuits(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Chunks (sub-tasks) table
CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  chunk_name TEXT NOT NULL DEFAULT '',
  duration INTEGER DEFAULT 15,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Task instances (calendar slots) table
CREATE TABLE IF NOT EXISTS task_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled',
  actual_duration_seconds INTEGER,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Progress logs table
CREATE TABLE IF NOT EXISTS progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY,
  available_hours JSONB DEFAULT '{}'::jsonb,
  auto_schedule BOOLEAN DEFAULT FALSE,
  sound_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. AI usage tracking table
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_task_instances_user_time
  ON task_instances (user_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_task_instances_parent_id
  ON task_instances (task_id);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id
  ON tasks (user_id);

CREATE INDEX IF NOT EXISTS idx_pursuits_user_id
  ON pursuits (user_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_logged_at
  ON journal_entries (user_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_journal_entries_pursuit_id
  ON journal_entries (pursuit_id);

CREATE INDEX IF NOT EXISTS idx_tasks_pursuit_id
  ON tasks (pursuit_id);

CREATE INDEX IF NOT EXISTS idx_progress_logs_task_id
  ON progress_logs (task_id);

-- ============================================================
-- RPC Functions
-- ============================================================

-- Get user peak hours (for the scheduler)
CREATE OR REPLACE FUNCTION get_user_peak_hours(uid UUID)
RETURNS TABLE(hour_of_day INTEGER, session_count BIGINT) AS $$
BEGIN
  RETURN QUERY
    SELECT
      EXTRACT(HOUR FROM pl.start_time)::INTEGER AS hour_of_day,
      COUNT(*)::BIGINT AS session_count
    FROM progress_logs pl
    WHERE pl.user_id = uid
    GROUP BY hour_of_day
    ORDER BY hour_of_day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment AI usage (with daily limit of 3)
CREATE OR REPLACE FUNCTION increment_ai_usage(uid UUID)
RETURNS VOID AS $$
DECLARE
  usage_count INTEGER;
BEGIN
  INSERT INTO ai_usage (user_id) VALUES (uid);

  SELECT COUNT(*) INTO usage_count
  FROM ai_usage
  WHERE user_id = uid
    AND created_at >= (NOW() AT TIME ZONE 'UTC')::DATE;

  IF usage_count > 3 THEN
    RAISE EXCEPTION 'DAILY_LIMIT_REACHED';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

-- IMPORTANT: Since we're using a dev bypass with a fake user ID,
-- we DISABLE RLS for now. Re-enable when using real auth.

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pursuits ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Permissive policies for dev (allow all operations for all users)
-- Replace these with proper user-scoped policies when enabling real auth

DROP POLICY IF EXISTS "Allow all on tasks" ON tasks;
DROP POLICY IF EXISTS "Allow all on pursuits" ON pursuits;
DROP POLICY IF EXISTS "Allow all on journal_entries" ON journal_entries;
DROP POLICY IF EXISTS "Allow all on chunks" ON chunks;
DROP POLICY IF EXISTS "Allow all on task_instances" ON task_instances;
DROP POLICY IF EXISTS "Allow all on progress_logs" ON progress_logs;
DROP POLICY IF EXISTS "Allow all on user_preferences" ON user_preferences;
DROP POLICY IF EXISTS "Allow all on ai_usage" ON ai_usage;

CREATE POLICY "Allow all on tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on pursuits" ON pursuits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on journal_entries" ON journal_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on chunks" ON chunks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on task_instances" ON task_instances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on progress_logs" ON progress_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on user_preferences" ON user_preferences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on ai_usage" ON ai_usage FOR ALL USING (true) WITH CHECK (true);
