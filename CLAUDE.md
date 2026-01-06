# SAIF Monorepo

## Overview

This monorepo contains two Next.js applications for SAIF Ventures that share a Supabase database:

- **@saif/crm** (`apps/crm`) - Internal CRM for managing deal flow, applications, partner voting, and deliberations
- **@saif/saif-face** (`apps/saif-face`) - Community platform for portfolio founders and company profiles

## Technology Stack

| Category | Technology |
|----------|------------|
| Package Manager | pnpm 9.x |
| Build System | Turborepo |
| Framework | Next.js 16.x |
| Language | TypeScript 5.x |
| Styling | Tailwind CSS 4.x |
| Database | Supabase (PostgreSQL) |
| Real-time | Liveblocks (CRM only) |

## Project Structure

```
saif-monorepo/
├── apps/
│   ├── crm/                  # SAIF CRM application (port 3001)
│   │   ├── app/              # Next.js App Router pages
│   │   ├── components/       # App-specific components
│   │   └── lib/              # App utilities and Liveblocks config
│   └── saif-face/            # SAIFface community platform (port 3002)
│       ├── app/              # Next.js App Router pages
│       └── lib/              # App utilities
├── packages/
│   ├── supabase/             # Shared Supabase client and types
│   │   └── src/
│   │       ├── client.ts     # Browser client
│   │       ├── server.ts     # Server client
│   │       ├── middleware.ts # Auth middleware helper
│   │       └── types/        # Database types
│   ├── ui/                   # Shared UI components
│   │   └── src/
│   │       ├── Toast.tsx     # Toast notifications
│   │       ├── ErrorBoundary.tsx
│   │       └── Providers.tsx # Root provider wrapper
│   └── config/               # Shared configs
│       ├── tsconfig.base.json
│       ├── tsconfig.nextjs.json
│       └── tailwind.config.ts
├── supabase/
│   ├── migrations/           # Database migrations
│   └── config.toml           # Supabase CLI config
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Shared Packages

### @saif/supabase

Shared Supabase client configuration and TypeScript types.

```typescript
// Browser client
import { createClient } from '@/lib/supabase/client'

// Server client (in Server Components or Route Handlers)
import { createClient } from '@/lib/supabase/server'

// Types
import type { Person, Company, Application } from '@saif/supabase/types'
```

### @saif/ui

Shared UI components used across both applications.

```typescript
// Root provider (includes Toast + ErrorBoundary)
import Providers from '@saif/ui/providers'

// Toast notifications
import { useToast } from '@saif/ui/toast'
const { showToast } = useToast()
showToast('Success!', 'success')

// Error boundary
import ErrorBoundary from '@saif/ui/error-boundary'
```

### @saif/config

Shared TypeScript and Tailwind configurations.

```typescript
// In app's tsconfig.json
{ "extends": "@saif/config/typescript/nextjs" }

// In app's tailwind.config.ts
import sharedConfig from '@saif/config/tailwind'
```

## Commands

```bash
# Install dependencies
pnpm install

# Run all apps in development
pnpm dev

# Run specific app
pnpm --filter @saif/crm dev      # CRM on port 3001
pnpm --filter @saif/saif-face dev  # SAIFface on port 3002

# Build all apps
pnpm build

# Type check all packages and apps
pnpm typecheck

# Lint all packages and apps
pnpm lint

# Clean all build artifacts
pnpm clean
```

## Database

### Shared Tables

Used by both applications:

| Table | Description |
|-------|-------------|
| `saif_people` | All people (partners, founders, advisors, etc.) |
| `saif_companies` | Portfolio and prospect companies |
| `saif_company_people` | Company-person relationships (junction table) |
| `saif_investments` | Investment records |

### CRM-Specific Tables

Used only by the CRM application:

| Table | Description |
|-------|-------------|
| `saifcrm_applications` | Deal flow applications |
| `saifcrm_votes` | Partner votes on applications |
| `saifcrm_deliberations` | Meeting deliberation records |
| `saifcrm_investments` | CRM investment records |

### Database Functions (RLS Helpers)

```sql
is_partner()      -- Returns true if current user is a partner
is_founder()      -- Returns true if current user is a founder
get_user_role()   -- Returns the user's role
get_person_id()   -- Returns the user's person ID
```

## Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Required for all apps
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Required for server operations
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# CRM app only
NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY=your-liveblocks-key
WEBHOOK_SECRET=your-webhook-secret
```

## Development Ports

| App | URL |
|-----|-----|
| CRM | http://localhost:3001 |
| SAIFface | http://localhost:3002 |

## Adding a New Shared Package

1. Create directory: `packages/new-package/`
2. Add `package.json` with name `@saif/new-package`
3. Add to consuming app's `package.json`: `"@saif/new-package": "workspace:*"`
4. Run `pnpm install`

## Migrations

Database migrations are stored in `supabase/migrations/`. Run them in order when setting up a new database.

See `supabase/migrations/000_RUN_ALL_MIGRATIONS.md` for instructions.
