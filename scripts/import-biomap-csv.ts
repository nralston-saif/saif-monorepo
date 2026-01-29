/**
 * Biomap CSV Import Script
 *
 * Usage: npx tsx scripts/import-biomap-csv.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { parse } from 'csv-parse/sync'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// CSV file path
const CSV_PATH = '/Users/Michael/Downloads/SAIF BioMap - Map.csv'

// Type mapping
const TYPE_MAP: Record<string, string> = {
  'gov': 'government',
  'government': 'government',
  'ngo': 'nonprofit',
  'non-profit': 'nonprofit',
  'nonprofit': 'nonprofit',
  'for-profit': 'for_profit',
  'for profit': 'for_profit',
  'startup': 'for_profit',
  'individual': 'other',
  'consortium': 'other',
}

interface CSVRow {
  Organization: string
  'Type (Gov, Non-profit, For-profit, Individual)': string
  'Focus (Prevention, Detection, Remediation)': string
  Description: string
  Contact: string
  'Contact Info': string
  'Contact Status': string
}

interface ImportStats {
  orgsCreated: number
  orgsSkipped: number
  peopleCreated: number
  peopleSkipped: number
  linksCreated: number
  errors: string[]
}

function parseEntityType(type: string): string | null {
  if (!type) return null
  const normalized = type.toLowerCase().trim()
  return TYPE_MAP[normalized] || 'other'
}

function parseContactNames(contactField: string): string[] {
  if (!contactField || contactField.trim() === '') return []

  // Skip placeholder values
  if (contactField.toLowerCase().includes('waiting for intro')) return []

  // Split by " and " to get individual names
  return contactField
    .split(/\s+and\s+/i)
    .map(name => name.trim())
    .filter(name => name.length > 0)
}

function parseEmails(emailField: string): string[] {
  if (!emailField || emailField.trim() === '') return []

  // Split by space, comma, or newline
  return emailField
    .split(/[\s,]+/)
    .map(email => email.trim().toLowerCase())
    .filter(email => email.includes('@'))
}

function parsePersonName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' }
  }
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')
  return { firstName, lastName }
}

async function getExistingOrgs(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('saif_companies')
    .select('name')

  if (error) {
    console.error('Error fetching existing orgs:', error)
    return new Set()
  }

  // Store lowercase names for case-insensitive comparison
  return new Set(data.map(org => org.name.toLowerCase()))
}

async function getExistingPeople(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('saif_people')
    .select('id, email')
    .not('email', 'is', null)

  if (error) {
    console.error('Error fetching existing people:', error)
    return new Map()
  }

  // Map email (lowercase) to person ID
  const emailToId = new Map<string, string>()
  for (const person of data) {
    if (person.email) {
      emailToId.set(person.email.toLowerCase(), person.id)
    }
  }
  return emailToId
}

async function createOrganization(
  name: string,
  entityType: string | null,
  description: string | null
): Promise<string | null> {
  const { data, error } = await supabase
    .from('saif_companies')
    .insert({
      name,
      entity_type: entityType,
      short_description: description || null,
      tags: ['bio'], // Add bio tag so it appears on biomap
      is_active: true,
      stage: 'tracked',
    })
    .select('id')
    .single()

  if (error) {
    console.error(`Error creating org "${name}":`, error.message)
    return null
  }

  return data.id
}

async function createPerson(
  firstName: string,
  lastName: string,
  email: string | null
): Promise<string | null> {
  const { data, error } = await supabase
    .from('saif_people')
    .insert({
      first_name: firstName,
      last_name: lastName || null,
      email: email,
      tags: ['bio'], // Add bio tag so they appear on biomap
      role: 'contact',
      status: 'tracked',
    })
    .select('id')
    .single()

  if (error) {
    console.error(`Error creating person "${firstName} ${lastName}":`, error.message)
    return null
  }

  return data.id
}

async function linkPersonToOrg(
  personId: string,
  companyId: string,
  isPrimary: boolean = true
): Promise<boolean> {
  // Check if link already exists
  const { data: existing } = await supabase
    .from('saif_company_people')
    .select('id')
    .eq('user_id', personId)
    .eq('company_id', companyId)
    .single()

  if (existing) {
    return false // Already linked
  }

  const { error } = await supabase
    .from('saif_company_people')
    .insert({
      user_id: personId,
      company_id: companyId,
      is_primary_contact: isPrimary,
    })

  if (error) {
    console.error(`Error linking person to org:`, error.message)
    return false
  }

  return true
}

async function importCSV(): Promise<void> {
  console.log('Starting biomap CSV import...\n')

  // Read and parse CSV
  const csvContent = readFileSync(CSV_PATH, 'utf-8')
  const records: CSVRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })

  // Filter out empty rows and header-like rows
  const validRows = records.filter(row => {
    const orgName = row.Organization?.trim()
    return orgName &&
           orgName.length > 0 &&
           !orgName.startsWith('Key Areas') &&
           orgName !== 'Prevention' &&
           orgName !== 'Detection' &&
           orgName !== 'Remediation' &&
           orgName !== 'PPE'
  })

  console.log(`Found ${validRows.length} organizations to process\n`)

  // Get existing data
  const existingOrgs = await getExistingOrgs()
  const existingPeople = await getExistingPeople()

  console.log(`Existing organizations: ${existingOrgs.size}`)
  console.log(`Existing people with emails: ${existingPeople.size}\n`)

  const stats: ImportStats = {
    orgsCreated: 0,
    orgsSkipped: 0,
    peopleCreated: 0,
    peopleSkipped: 0,
    linksCreated: 0,
    errors: [],
  }

  for (const row of validRows) {
    const orgName = row.Organization.trim()
    const entityType = parseEntityType(row['Type (Gov, Non-profit, For-profit, Individual)'])
    const description = row.Description?.trim() || null
    const contactNames = parseContactNames(row.Contact)
    const emails = parseEmails(row['Contact Info'])

    console.log(`\nProcessing: ${orgName}`)

    // Check if org exists
    let companyId: string | null = null
    if (existingOrgs.has(orgName.toLowerCase())) {
      console.log(`  - Organization already exists, skipping`)
      stats.orgsSkipped++

      // Get the existing org ID to link contacts
      const { data: existingOrg } = await supabase
        .from('saif_companies')
        .select('id')
        .ilike('name', orgName)
        .single()

      if (existingOrg) {
        companyId = existingOrg.id
      }
    } else {
      // Create organization
      companyId = await createOrganization(orgName, entityType, description)
      if (companyId) {
        console.log(`  - Created organization`)
        stats.orgsCreated++
        existingOrgs.add(orgName.toLowerCase())
      } else {
        stats.errors.push(`Failed to create org: ${orgName}`)
        continue
      }
    }

    // Process contacts
    if (contactNames.length === 0) {
      console.log(`  - No contacts to add`)
      continue
    }

    // Try to match names with emails
    for (let i = 0; i < contactNames.length; i++) {
      const name = contactNames[i]
      const email = emails[i] || null // May not have email for all contacts
      const { firstName, lastName } = parsePersonName(name)

      console.log(`  - Contact: ${firstName} ${lastName}${email ? ` <${email}>` : ' (no email)'}`)

      let personId: string | null = null

      // Check if person exists by email
      if (email && existingPeople.has(email.toLowerCase())) {
        console.log(`    - Person already exists, skipping creation`)
        personId = existingPeople.get(email.toLowerCase())!
        stats.peopleSkipped++
      } else {
        // Create person
        personId = await createPerson(firstName, lastName, email)
        if (personId) {
          console.log(`    - Created person`)
          stats.peopleCreated++
          if (email) {
            existingPeople.set(email.toLowerCase(), personId)
          }
        } else {
          stats.errors.push(`Failed to create person: ${name}`)
          continue
        }
      }

      // Link person to organization
      if (personId && companyId) {
        const linked = await linkPersonToOrg(personId, companyId, i === 0)
        if (linked) {
          console.log(`    - Linked to organization`)
          stats.linksCreated++
        } else {
          console.log(`    - Already linked to organization`)
        }
      }
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(50))
  console.log('IMPORT COMPLETE')
  console.log('='.repeat(50))
  console.log(`Organizations created: ${stats.orgsCreated}`)
  console.log(`Organizations skipped: ${stats.orgsSkipped}`)
  console.log(`People created: ${stats.peopleCreated}`)
  console.log(`People skipped: ${stats.peopleSkipped}`)
  console.log(`Links created: ${stats.linksCreated}`)

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`)
    stats.errors.forEach(err => console.log(`  - ${err}`))
  }
}

// Run the import
importCSV().catch(console.error)
