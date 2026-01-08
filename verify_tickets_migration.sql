-- Run this query in Supabase SQL Editor to verify the tickets table was created correctly

-- 1. Check if table exists
SELECT
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE tablename = 'saif_tickets';

-- 2. Check table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'saif_tickets'
ORDER BY ordinal_position;

-- 3. Check indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'saif_tickets';

-- 4. Check RLS is enabled
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'saif_tickets';

-- 5. Check RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'saif_tickets';

-- If all queries return results, your migrations were successful!
