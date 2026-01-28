-- Migration: Add missing columns to saif_investments
-- Purpose: Support full migration from saifcrm_investments by adding denormalized fields

-- Add columns that exist in saifcrm_investments but not in saif_investments
ALTER TABLE saif_investments
ADD COLUMN IF NOT EXISTS terms TEXT,
ADD COLUMN IF NOT EXISTS other_funders TEXT,
ADD COLUMN IF NOT EXISTS stealthy BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notes TEXT;
