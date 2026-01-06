# SAIF Database Migrations - Run Guide

## ⚠️ IMPORTANT: Pre-Migration Checklist

- [ ] **Backup database** (Supabase Dashboard → Database → Backup or `pg_dump`)
- [ ] **Review all SQL files** in this directory
- [ ] **Coordinate with Nick** on timing
- [ ] **Test on staging first** if available
- [ ] **All team members aware** of migration

## Migration Files (Run in Order)

### 001_enhance_saif_users.sql
**What it does:**
- Adds missing columns to existing saif_users table
- Parses "name" field into first_name/last_name
- Adds status, bio, avatar_url, social links, etc.
- Creates updated_at trigger

**Impact:** NON-DESTRUCTIVE - only adds columns to existing table

**Time:** ~1 minute

---

### 002_create_saif_companies.sql
**What it does:**
- Creates saif_companies table
- Migrates data from saifcrm_investments (31 portfolio companies)
- Migrates data from saifcrm_applications (223 applications)
- Deduplicates companies that appear in both tables
- Sets appropriate stage (portfolio, prospect, passed, etc.)

**Impact:** NON-DESTRUCTIVE - creates new table, doesn't touch existing

**Time:** ~2 minutes

**Result:** ~250 companies in saif_companies

---

### 003_create_saif_investments.sql
**What it does:**
- Creates enhanced saif_investments table
- Copies data from saifcrm_investments
- Parses investment type from "terms" field (SAFE, note, equity)
- Parses valuation caps from terms ("20mm cap" → $20M)
- Links to saif_companies via company_id

**Impact:** NON-DESTRUCTIVE - creates new table, doesn't modify saifcrm_investments

**Time:** ~1 minute

**Result:** ~31 investments migrated

---

### 004_create_company_people.sql
**What it does:**
- Creates saif_company_people junction table
- Sets up relationships between users and companies
- Prepares for founder parsing

**Impact:** NON-DESTRUCTIVE - creates empty table

**Time:** <1 minute

---

### 005_parse_founders.sql
**What it does:**
- Parses founder names from text fields
- Creates saif_users records for each founder
- Links founders to companies via saif_company_people
- Handles various formats (newline, comma-separated)
- Sets status='pending' for founders to claim later

**Impact:** CREATES DATA - adds ~60-100 founder user records

**Time:** ~3 minutes

**Result:** All founders from applications + investments become users

---

### 006_create_rls_policies.sql
**What it does:**
- Enables Row Level Security on all tables
- Creates helper functions (is_partner, is_founder)
- Creates comprehensive access control policies
- Partners: full access to everything
- Founders: view portfolio companies, edit own profile
- Protects CRM tables (partners-only)

**Impact:** SECURITY - enforces access control

**Time:** ~2 minutes

---

### 007_create_storage_buckets.sql
**What it does:**
- Documents bucket creation steps
- Creates storage policies for avatars and logos
- Users can upload/edit their own avatars
- Founders can upload their company logos
- Partners can upload any logo

**Impact:** REQUIRES MANUAL STEP - buckets must be created via Dashboard first

**Time:** ~5 minutes (manual + SQL)

---

## How to Run Migrations

### Option 1: Supabase Dashboard SQL Editor (Recommended)

1. Go to **Supabase Dashboard → SQL Editor**
2. For each migration file (001 through 007):
   - Create new query
   - Copy contents of migration file
   - Click "Run"
   - Verify success message
   - Check for any errors

### Option 2: psql Command Line

```bash
# From project root
psql "postgresql://postgres:PASSWORD@db.dxllkeajdtbtvsjjoaxr.supabase.co:5432/postgres" \
  -f supabase/migrations_v2/001_enhance_saif_users.sql

# Repeat for each file...
```

### Option 3: Automated Script

```bash
#!/bin/bash
# run_migrations.sh

DB_URL="postgresql://postgres:PASSWORD@db.dxllkeajdtbtvsjjoaxr.supabase.co:5432/postgres"

echo "Running SAIF database migrations..."

for file in supabase/migrations_v2/{001..007}*.sql; do
  echo "Running $file..."
  psql "$DB_URL" -f "$file"
  if [ $? -eq 0 ]; then
    echo "✓ $file completed successfully"
  else
    echo "✗ $file failed!"
    exit 1
  fi
done

echo "All migrations completed!"
```

## Post-Migration Tasks

### 1. Create Storage Buckets (Manual)

Go to **Supabase Dashboard → Storage**:

1. Click "New Bucket"
2. Create "saif-avatars":
   - Name: `saif-avatars`
   - Public: NO
   - File size limit: 5MB
   - Allowed types: image/jpeg, image/png, image/webp

3. Create "saif-company-logos":
   - Name: `saif-company-logos`
   - Public: NO
   - File size limit: 2MB
   - Allowed types: image/jpeg, image/png, image/svg+xml

### 2. Verify Data

```sql
-- Check user counts
SELECT role, status, COUNT(*) as count
FROM saif_users
GROUP BY role, status;

-- Expected:
-- partner | active  | 3
-- founder | pending | ~60-100

-- Check company counts
SELECT stage, COUNT(*) as count
FROM saif_companies
GROUP BY stage;

-- Expected:
-- portfolio | 31
-- prospect  | ~190
-- passed    | ~20

-- Check company-founder relationships
SELECT COUNT(*) as founder_relationships
FROM saif_company_people
WHERE relationship_type = 'founder';

-- Expected: ~60-100
```

### 3. Update Existing Partners

Make sure partners have complete profiles:

```sql
UPDATE saif_users
SET status = 'active'
WHERE email IN ('mike@saif.vc', 'geoff@saif.vc', 'nick@saif.vc');
```

### 4. Test RLS

```sql
-- Test as partner (should see everything)
SELECT COUNT(*) FROM saif_users;        -- All users
SELECT COUNT(*) FROM saif_companies;    -- All companies
SELECT COUNT(*) FROM saif_investments;  -- All investments

-- Test as founder (limited access)
-- Login as a founder user, then:
SELECT COUNT(*) FROM saif_users WHERE status = 'active';  -- Active users only
SELECT COUNT(*) FROM saif_companies WHERE stage = 'portfolio';  -- Portfolio only
SELECT COUNT(*) FROM saif_investments;  -- Own company only
```

## Rollback Plan

If something goes wrong:

```sql
-- Rollback storage policies
DROP POLICY IF EXISTS "Authenticated users view avatars" ON storage.objects;
-- ... (drop all storage policies)

-- Rollback RLS
DROP POLICY IF EXISTS "View active profiles" ON saif_users;
-- ... (drop all policies)

-- Rollback tables (WARNING: DESTRUCTIVE)
DROP TABLE IF EXISTS saif_company_people CASCADE;
DROP TABLE IF EXISTS saif_investments CASCADE;
DROP TABLE IF EXISTS saif_companies CASCADE;

-- Rollback saif_users changes
ALTER TABLE saif_users
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS first_name,
-- ... (drop all new columns)

-- Restore from backup (safest option)
psql "$DB_URL" < backup_before_migration.sql
```

## Nick's CRM Migration

After these migrations, Nick should update his CRM to use the new tables:

**Changes needed in Nick's code:**

1. **Replace** `saifcrm_investments` references with `saif_investments`
2. **Replace** inline `company_name` with `company_id` FK to `saif_companies`
3. **Use** `saif_companies` for company data instead of inline fields
4. **Query** `saif_company_people` for founder relationships

**Example query updates:**

```sql
-- OLD (inline company data)
SELECT company_name, amount FROM saifcrm_investments;

-- NEW (join to companies table)
SELECT c.name, i.amount
FROM saif_investments i
JOIN saif_companies c ON c.id = i.company_id;
```

## Timeline

- **Migrations:** 15-20 minutes
- **Storage buckets:** 5 minutes
- **Verification:** 10 minutes
- **Nick's CRM updates:** 1-2 hours
- **Testing:** 2-4 hours

**Total:** Half day for full migration and testing

## Support

Questions? Issues? Contact:
- Geoff (geoff@saif.vc)
- Nick (nick@saif.vc)
