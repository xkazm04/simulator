-- Migration: 004_add_whatifs_table
-- Description: Add WhatIf comparison pairs table for before/after image comparisons
-- Created: 2025-02-01
-- Target: Supabase PostgreSQL

-- ============================================================================
-- WhatIf comparison pairs (before/after images per project)
-- Each row represents one comparison pair
-- ============================================================================
CREATE TABLE IF NOT EXISTS simulator_project_whatifs (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES simulator_projects(id) ON DELETE CASCADE,
  -- Before image (left side)
  before_image_url TEXT,
  before_caption TEXT,
  -- After image (right side)
  after_image_url TEXT,
  after_caption TEXT,
  -- Ordering for multiple pairs
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Update panel images slot constraint for expanded slots (0-9 instead of 0-4)
-- ============================================================================
ALTER TABLE simulator_panel_images
DROP CONSTRAINT IF EXISTS simulator_panel_images_slot_index_check;

ALTER TABLE simulator_panel_images
ADD CONSTRAINT simulator_panel_images_slot_index_check
CHECK (slot_index >= 0 AND slot_index < 10);

-- ============================================================================
-- Indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_simulator_project_whatifs_project
ON simulator_project_whatifs(project_id);

CREATE INDEX IF NOT EXISTS idx_simulator_project_whatifs_order
ON simulator_project_whatifs(project_id, display_order);

-- ============================================================================
-- Updated_at trigger for whatifs
-- ============================================================================
DROP TRIGGER IF EXISTS update_simulator_project_whatifs_updated_at ON simulator_project_whatifs;
CREATE TRIGGER update_simulator_project_whatifs_updated_at
  BEFORE UPDATE ON simulator_project_whatifs
  FOR EACH ROW
  EXECUTE FUNCTION simulator_update_updated_at_column();
