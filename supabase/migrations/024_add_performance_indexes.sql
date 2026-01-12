-- Migration: Add Performance Indexes
-- Purpose: Speed up common queries across the CRM application

-- Notifications: filtered by recipient_id on dashboard
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id
ON saifcrm_notifications(recipient_id);

-- Notifications: also filter by read status
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
ON saifcrm_notifications(recipient_id, read_at)
WHERE read_at IS NULL;

-- Tickets: filtered by assigned_to on dashboard
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to
ON saif_tickets(assigned_to);

-- Tickets: filtered by status for active tickets
CREATE INDEX IF NOT EXISTS idx_tickets_status
ON saif_tickets(status)
WHERE status != 'archived';

-- Votes: filtered by application_id and vote_type
CREATE INDEX IF NOT EXISTS idx_votes_application_type
ON saifcrm_votes(application_id, vote_type);

-- Applications: filtered by stage frequently
CREATE INDEX IF NOT EXISTS idx_applications_stage
ON saifcrm_applications(stage);

-- Applications: sorted by submitted_at
CREATE INDEX IF NOT EXISTS idx_applications_submitted
ON saifcrm_applications(submitted_at DESC);

-- Company people: filtered by company_id and relationship_type
CREATE INDEX IF NOT EXISTS idx_company_people_company
ON saif_company_people(company_id);

CREATE INDEX IF NOT EXISTS idx_company_people_relationship
ON saif_company_people(company_id, relationship_type);

-- People: filtered by auth_user_id for profile lookups
CREATE INDEX IF NOT EXISTS idx_people_auth_user
ON saif_people(auth_user_id)
WHERE auth_user_id IS NOT NULL;

-- People: filtered by status for community page
CREATE INDEX IF NOT EXISTS idx_people_status
ON saif_people(status);

-- Investments: sorted by investment_date
CREATE INDEX IF NOT EXISTS idx_investments_date
ON saifcrm_investments(investment_date DESC);
