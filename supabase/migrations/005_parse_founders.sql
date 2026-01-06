-- =====================================================
-- Migration 005: Parse Founders and Create People Records
-- Description: Extract founder names from text fields and create structured data
-- Note: Uses saif_people table (people may or may not have auth accounts)
-- =====================================================

-- Helper function to clean founder names (remove parentheses, extra spaces)
CREATE OR REPLACE FUNCTION clean_founder_name(name text)
RETURNS text AS $$
BEGIN
  -- Remove content in parentheses (nicknames)
  name := regexp_replace(name, '\s*\([^)]*\)', '', 'g');
  -- Trim whitespace
  name := TRIM(name);
  -- Remove multiple spaces
  name := regexp_replace(name, '\s+', ' ', 'g');
  RETURN name;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Parse founders from saifcrm_investments
DO $$
DECLARE
  inv_record RECORD;
  company_rec RECORD;
  founder_name text;
  founder_names text[];
  cleaned_name text;
  tmp_first_name text;
  tmp_last_name text;
  new_user_id uuid;
  contact_email text;
BEGIN
  FOR inv_record IN
    SELECT i.*, c.id as company_id
    FROM saifcrm_investments i
    JOIN saif_companies c ON LOWER(TRIM(c.name)) = LOWER(TRIM(i.company_name))
    WHERE i.founders IS NOT NULL AND i.founders != ''
  LOOP
    -- Split founders by newline or comma
    IF inv_record.founders ~ E'\\r\\n|\\n' THEN
      founder_names := string_to_array(inv_record.founders, E'\n');
    ELSIF inv_record.founders ~ ',' THEN
      founder_names := string_to_array(inv_record.founders, ',');
    ELSE
      founder_names := ARRAY[inv_record.founders];
    END IF;

    -- Process each founder name
    FOREACH founder_name IN ARRAY founder_names
    LOOP
      -- Clean the name
      cleaned_name := clean_founder_name(founder_name);

      IF cleaned_name IS NOT NULL AND cleaned_name != '' AND LENGTH(cleaned_name) > 1 THEN
        -- Split into first/last name
        IF cleaned_name LIKE '% %' THEN
          tmp_first_name := split_part(cleaned_name, ' ', 1);
          tmp_last_name := substring(cleaned_name from position(' ' in cleaned_name) + 1);
        ELSE
          tmp_first_name := cleaned_name;
          tmp_last_name := NULL;
        END IF;

        -- Try to get contact email (if it's the first/primary founder)
        contact_email := CASE
          WHEN founder_name = (string_to_array(inv_record.founders, E'\n'))[1]
               OR founder_name = (string_to_array(inv_record.founders, ','))[1]
          THEN inv_record.contact_email
          ELSE NULL
        END;

        -- Check if person already exists (by email first, then by name)
        SELECT p.id INTO new_user_id
        FROM saif_people p
        WHERE (contact_email IS NOT NULL AND p.email = contact_email)
           OR (p.first_name = tmp_first_name
               AND (p.last_name = tmp_last_name OR (p.last_name IS NULL AND tmp_last_name IS NULL)))
        LIMIT 1;

        -- Create person if doesn't exist (portfolio founder - will have platform access)
        IF new_user_id IS NULL THEN
          INSERT INTO saif_people (email, role, status, first_name, last_name)
          VALUES (
            contact_email,  -- May be NULL
            'founder',
            'pending',  -- Invited to platform, awaiting signup
            tmp_first_name,
            tmp_last_name
          )
          RETURNING id INTO new_user_id;

          RAISE NOTICE 'Created portfolio founder: % % (ID: %)', tmp_first_name, tmp_last_name, new_user_id;
        END IF;

        -- Link founder to company
        INSERT INTO saif_company_people (company_id, user_id, relationship_type, is_primary_contact)
        VALUES (
          inv_record.company_id,
          new_user_id,
          'founder',
          contact_email IS NOT NULL  -- Primary contact if has email
        )
        ON CONFLICT (company_id, user_id, relationship_type) WHERE end_date IS NULL
        DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Parse founders from saifcrm_applications (for companies not yet invested)
DO $$
DECLARE
  app_record RECORD;
  company_rec RECORD;
  founder_name text;
  founder_names text[];
  cleaned_name text;
  tmp_first_name text;
  tmp_last_name text;
  new_user_id uuid;
  primary_email text;
BEGIN
  FOR app_record IN
    SELECT a.*, c.id as company_id
    FROM saifcrm_applications a
    JOIN saif_companies c ON LOWER(TRIM(c.name)) = LOWER(TRIM(a.company_name))
    WHERE a.founder_names IS NOT NULL AND a.founder_names != ''
      -- Only process if not already in investments
      AND NOT EXISTS (
        SELECT 1 FROM saifcrm_investments i
        WHERE LOWER(TRIM(i.company_name)) = LOWER(TRIM(a.company_name))
      )
  LOOP
    -- Split founders by newline or comma
    IF app_record.founder_names ~ E'\\r\\n|\\n' THEN
      founder_names := string_to_array(app_record.founder_names, E'\n');
    ELSIF app_record.founder_names ~ ',' THEN
      founder_names := string_to_array(app_record.founder_names, ',');
    ELSE
      founder_names := ARRAY[app_record.founder_names];
    END IF;

    -- Process each founder name
    FOREACH founder_name IN ARRAY founder_names
    LOOP
      cleaned_name := clean_founder_name(founder_name);

      IF cleaned_name IS NOT NULL AND cleaned_name != '' AND LENGTH(cleaned_name) > 1 THEN
        -- Split into first/last name
        IF cleaned_name LIKE '% %' THEN
          tmp_first_name := split_part(cleaned_name, ' ', 1);
          tmp_last_name := substring(cleaned_name from position(' ' in cleaned_name) + 1);
        ELSE
          tmp_first_name := cleaned_name;
          tmp_last_name := NULL;
        END IF;

        -- Use primary_email for first founder
        primary_email := CASE
          WHEN founder_name = (string_to_array(app_record.founder_names, E'\n'))[1]
               OR founder_name = (string_to_array(app_record.founder_names, ','))[1]
          THEN app_record.primary_email
          ELSE NULL
        END;

        -- Check if person already exists (by email first, then by name)
        SELECT p.id INTO new_user_id
        FROM saif_people p
        WHERE (primary_email IS NOT NULL AND p.email = primary_email)
           OR (p.first_name = tmp_first_name
               AND (p.last_name = tmp_last_name OR (p.last_name IS NULL AND tmp_last_name IS NULL)))
        LIMIT 1;

        -- Create person if doesn't exist (prospect/rejected founder - no platform access)
        IF new_user_id IS NULL THEN
          INSERT INTO saif_people (email, role, status, first_name, last_name)
          VALUES (
            primary_email,
            'founder',
            'tracked',  -- Just tracking, no platform access
            tmp_first_name,
            tmp_last_name
          )
          RETURNING id INTO new_user_id;

          RAISE NOTICE 'Created tracked founder: % % (ID: %)', tmp_first_name, tmp_last_name, new_user_id;
        END IF;

        -- Link founder to company
        INSERT INTO saif_company_people (company_id, user_id, relationship_type, is_primary_contact)
        VALUES (
          app_record.company_id,
          new_user_id,
          'founder',
          primary_email IS NOT NULL
        )
        ON CONFLICT (company_id, user_id, relationship_type) WHERE end_date IS NULL
        DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Display results
SELECT
  'Founder Parsing Complete' as status,
  COUNT(*) FILTER (WHERE role = 'founder') as total_founders,
  COUNT(*) FILTER (WHERE role = 'founder' AND status = 'pending') as portfolio_founders_pending,
  COUNT(*) FILTER (WHERE role = 'founder' AND status = 'tracked') as tracked_founders_no_access,
  COUNT(*) FILTER (WHERE role = 'founder' AND email IS NOT NULL) as founders_with_email,
  COUNT(*) FILTER (WHERE role = 'partner') as partners
FROM saif_people;

-- Show breakdown by status
SELECT
  role,
  status,
  COUNT(*) as count,
  COUNT(email) as with_email,
  COUNT(auth_user_id) as with_auth_account
FROM saif_people
GROUP BY role, status
ORDER BY role, status;

-- Clean up helper function (optional - keep if useful)
-- DROP FUNCTION clean_founder_name(text);
