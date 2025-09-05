-- Database Schema Fixes for Missing Columns
-- Run this to add missing columns to existing tables

-- Add missing columns to stacks table
ALTER TABLE stacks ADD COLUMN is_public BOOLEAN DEFAULT FALSE;

-- Verify table structures
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;