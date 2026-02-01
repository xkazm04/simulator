-- Migration: 003_add_panel_image_type
-- Description: Add 'type' column to simulator_panel_images to track output mode
-- Created: 2025-02-01
-- Target: Supabase PostgreSQL

-- ============================================================================
-- Add type column to panel images
-- Stores the output mode used to generate the image (gameplay, trailer, sketch)
-- ============================================================================
ALTER TABLE simulator_panel_images
ADD COLUMN IF NOT EXISTS type TEXT CHECK(type IN ('gameplay', 'trailer', 'sketch', 'poster'));

-- ============================================================================
-- Create index for filtering by type
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_simulator_panel_images_type ON simulator_panel_images(type);

-- ============================================================================
-- Add comment for documentation
-- ============================================================================
COMMENT ON COLUMN simulator_panel_images.type IS 'Output mode used for generation: gameplay, trailer, sketch, or poster';
