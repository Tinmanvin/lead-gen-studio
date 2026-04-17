-- Migration: 2026-04-17 — add missing lead columns
-- These were in the build plan (Task 1) but not applied in previous migration.
-- Safe to re-run (IF NOT EXISTS).

ALTER TABLE leads ADD COLUMN IF NOT EXISTS signals TEXT[];
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tech_stack TEXT[];
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_chatbot BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_ssl BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_booking BOOLEAN DEFAULT false;
