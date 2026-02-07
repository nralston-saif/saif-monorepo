-- =====================================================
-- Migration 051: Update get_tickets_page_data Function
-- Description: Add source and feedback_type columns to ticket data
-- =====================================================

-- Update the function to include the new columns for founder feedback support
CREATE OR REPLACE FUNCTION get_tickets_page_data(p_limit INT DEFAULT 500)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'tickets', (
      SELECT COALESCE(json_agg(t ORDER BY t.created_at DESC), '[]'::json)
      FROM (
        SELECT
          tk.id,
          tk.title,
          tk.description,
          tk.status,
          tk.priority,
          tk.due_date,
          tk.assigned_to,
          tk.created_by,
          tk.related_company,
          tk.related_person,
          tk.tags,
          tk.created_at,
          tk.updated_at,
          tk.archived_at,
          tk.application_id,
          tk.was_unassigned_at_creation,
          tk.is_flagged,
          tk.source,
          tk.feedback_type,
          json_build_object(
            'id', ap.id,
            'first_name', ap.first_name,
            'last_name', ap.last_name,
            'email', ap.email,
            'avatar_url', ap.avatar_url
          ) AS assigned_partner,
          json_build_object(
            'id', cr.id,
            'first_name', cr.first_name,
            'last_name', cr.last_name,
            'email', cr.email,
            'avatar_url', cr.avatar_url
          ) AS creator,
          CASE WHEN co.id IS NOT NULL THEN
            json_build_object('id', co.id, 'name', co.name, 'logo_url', co.logo_url)
          ELSE NULL END AS company,
          CASE WHEN pe.id IS NOT NULL THEN
            json_build_object('id', pe.id, 'first_name', pe.first_name, 'last_name', pe.last_name, 'email', pe.email)
          ELSE NULL END AS person,
          CASE WHEN app.id IS NOT NULL THEN
            json_build_object('id', app.id, 'company_name', app.company_name, 'draft_rejection_email', app.draft_rejection_email, 'primary_email', app.primary_email)
          ELSE NULL END AS application,
          (
            SELECT COALESCE(json_agg(
              json_build_object(
                'id', c.id,
                'ticket_id', c.ticket_id,
                'author_id', c.author_id,
                'content', c.content,
                'is_final_comment', c.is_final_comment,
                'is_testing_comment', c.is_testing_comment,
                'is_reactivated_comment', c.is_reactivated_comment,
                'created_at', c.created_at,
                'updated_at', c.updated_at,
                'author', json_build_object(
                  'id', ca.id,
                  'first_name', ca.first_name,
                  'last_name', ca.last_name,
                  'email', ca.email,
                  'avatar_url', ca.avatar_url
                )
              ) ORDER BY c.created_at
            ), '[]'::json)
            FROM saif_ticket_comments c
            LEFT JOIN saif_people ca ON ca.id = c.author_id
            WHERE c.ticket_id = tk.id
          ) AS comments
        FROM saif_tickets tk
        LEFT JOIN saif_people ap ON ap.id = tk.assigned_to
        LEFT JOIN saif_people cr ON cr.id = tk.created_by
        LEFT JOIN saif_companies co ON co.id = tk.related_company
        LEFT JOIN saif_people pe ON pe.id = tk.related_person
        LEFT JOIN saifcrm_applications app ON app.id = tk.application_id
        ORDER BY tk.created_at DESC
        LIMIT p_limit
      ) t
    ),
    'partners', (
      SELECT COALESCE(json_agg(p ORDER BY p.first_name), '[]'::json)
      FROM (
        SELECT id, first_name, last_name, email, avatar_url
        FROM saif_people
        WHERE role = 'partner' AND status = 'active'
      ) p
    ),
    'companies', (
      SELECT COALESCE(json_agg(c ORDER BY c.name), '[]'::json)
      FROM (
        SELECT id, name, logo_url
        FROM saif_companies
        WHERE is_active = true
      ) c
    ),
    'people', (
      SELECT COALESCE(json_agg(pe ORDER BY pe.first_name), '[]'::json)
      FROM (
        SELECT id, first_name, last_name, email
        FROM saif_people
        WHERE status = 'active'
      ) pe
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Log results
SELECT 'get_tickets_page_data function updated with source and feedback_type columns' as migration_status;
