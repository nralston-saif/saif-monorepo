-- Performance optimization: Consolidated queries as database functions
-- These reduce multiple round-trips between Vercel and Supabase into single calls

-- Function to get all data needed for the tickets page in one call
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

-- Function to get all data needed for the deals page in one call
CREATE OR REPLACE FUNCTION get_deals_page_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'applications', (
      SELECT COALESCE(json_agg(a ORDER BY a.submitted_at DESC), '[]'::json)
      FROM (
        SELECT
          app.id,
          app.company_id,
          app.company_name,
          app.founder_names,
          app.founder_linkedins,
          app.founder_bios,
          app.primary_email,
          app.company_description,
          app.website,
          app.previous_funding,
          app.deck_link,
          app.submitted_at,
          app.votes_revealed,
          app.stage,
          app.email_sent,
          app.email_sent_at,
          app.draft_rejection_email,
          (
            SELECT COALESCE(json_agg(
              json_build_object(
                'id', v.id,
                'vote', v.vote,
                'user_id', v.user_id,
                'notes', v.notes,
                'vote_type', v.vote_type,
                'saif_people', json_build_object('name', vp.name)
              )
            ), '[]'::json)
            FROM saifcrm_votes v
            LEFT JOIN saif_people vp ON vp.id = v.user_id
            WHERE v.application_id = app.id
          ) AS saifcrm_votes,
          (
            SELECT COALESCE(json_agg(
              json_build_object(
                'id', d.id,
                'meeting_date', d.meeting_date,
                'idea_summary', d.idea_summary,
                'thoughts', d.thoughts,
                'decision', d.decision,
                'status', d.status,
                'tags', d.tags
              )
            ), '[]'::json)
            FROM saifcrm_deliberations d
            WHERE d.application_id = app.id
          ) AS saifcrm_deliberations,
          CASE WHEN es.id IS NOT NULL THEN
            json_build_object('name', es.name)
          ELSE NULL END AS email_sender
        FROM saifcrm_applications app
        LEFT JOIN saif_people es ON es.id = app.email_sender_id
        WHERE app.stage IN ('new', 'application', 'interview', 'portfolio', 'rejected')
        ORDER BY app.submitted_at DESC
      ) a
    ),
    'partners', (
      SELECT COALESCE(json_agg(p ORDER BY p.name), '[]'::json)
      FROM (
        SELECT id, name
        FROM saif_people
        WHERE role = 'partner' AND status = 'active'
      ) p
    ),
    'interviewTags', (
      SELECT COALESCE(json_agg(t ORDER BY t.name), '[]'::json)
      FROM (
        SELECT name, color
        FROM saif_tags
        WHERE category = 'interview'
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_tickets_page_data(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_deals_page_data() TO authenticated;
