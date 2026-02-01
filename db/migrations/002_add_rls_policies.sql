-- Migration: 002_add_rls_policies
-- Description: Add Row Level Security policies for public access (hackathon mode)
-- Created: 2025-01-31
-- Target: Supabase PostgreSQL
-- Note: This migration runs AFTER 001_baseline_schema.sql

-- ============================================================================
-- Enable Row Level Security on all tables
-- ============================================================================
ALTER TABLE simulator_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulator_project_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulator_panel_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulator_project_posters ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulator_interactive_prototypes ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulator_generated_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulator_project_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulator_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Public access policies (hackathon mode - no auth required)
-- These allow all operations for anonymous users
-- ============================================================================

-- Projects
CREATE POLICY "Allow public read on simulator_projects"
  ON simulator_projects FOR SELECT USING (true);
CREATE POLICY "Allow public insert on simulator_projects"
  ON simulator_projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on simulator_projects"
  ON simulator_projects FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on simulator_projects"
  ON simulator_projects FOR DELETE USING (true);

-- Project State
CREATE POLICY "Allow public read on simulator_project_state"
  ON simulator_project_state FOR SELECT USING (true);
CREATE POLICY "Allow public insert on simulator_project_state"
  ON simulator_project_state FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on simulator_project_state"
  ON simulator_project_state FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on simulator_project_state"
  ON simulator_project_state FOR DELETE USING (true);

-- Panel Images
CREATE POLICY "Allow public read on simulator_panel_images"
  ON simulator_panel_images FOR SELECT USING (true);
CREATE POLICY "Allow public insert on simulator_panel_images"
  ON simulator_panel_images FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on simulator_panel_images"
  ON simulator_panel_images FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on simulator_panel_images"
  ON simulator_panel_images FOR DELETE USING (true);

-- Project Posters
CREATE POLICY "Allow public read on simulator_project_posters"
  ON simulator_project_posters FOR SELECT USING (true);
CREATE POLICY "Allow public insert on simulator_project_posters"
  ON simulator_project_posters FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on simulator_project_posters"
  ON simulator_project_posters FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on simulator_project_posters"
  ON simulator_project_posters FOR DELETE USING (true);

-- Interactive Prototypes
CREATE POLICY "Allow public read on simulator_interactive_prototypes"
  ON simulator_interactive_prototypes FOR SELECT USING (true);
CREATE POLICY "Allow public insert on simulator_interactive_prototypes"
  ON simulator_interactive_prototypes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on simulator_interactive_prototypes"
  ON simulator_interactive_prototypes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on simulator_interactive_prototypes"
  ON simulator_interactive_prototypes FOR DELETE USING (true);

-- Generated Prompts
CREATE POLICY "Allow public read on simulator_generated_prompts"
  ON simulator_generated_prompts FOR SELECT USING (true);
CREATE POLICY "Allow public insert on simulator_generated_prompts"
  ON simulator_generated_prompts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on simulator_generated_prompts"
  ON simulator_generated_prompts FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on simulator_generated_prompts"
  ON simulator_generated_prompts FOR DELETE USING (true);

-- Project Metadata
CREATE POLICY "Allow public read on simulator_project_metadata"
  ON simulator_project_metadata FOR SELECT USING (true);
CREATE POLICY "Allow public insert on simulator_project_metadata"
  ON simulator_project_metadata FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on simulator_project_metadata"
  ON simulator_project_metadata FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on simulator_project_metadata"
  ON simulator_project_metadata FOR DELETE USING (true);

-- Sessions
CREATE POLICY "Allow public read on simulator_sessions"
  ON simulator_sessions FOR SELECT USING (true);
CREATE POLICY "Allow public insert on simulator_sessions"
  ON simulator_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on simulator_sessions"
  ON simulator_sessions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on simulator_sessions"
  ON simulator_sessions FOR DELETE USING (true);
