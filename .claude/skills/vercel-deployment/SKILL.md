---
name: vercel-deployment
description: Automated Vercel deployment workflow with pre-deployment validation, deployment monitoring, and failure recovery. Use when deploying code to Vercel via GitHub, checking deployment status, fixing deployment failures, or validating code before push. Triggers on requests involving Vercel deployments, build failures, GitHub push with Vercel autodeploy, or deployment debugging.
---

# Vercel Deployment Skill

Automates the Vercel deployment lifecycle: pre-deployment validation, deployment monitoring, and iterative failure recovery using browser MCP for build log analysis.

## Workflow Overview

1. **Pre-deployment validation** - Check and fix code issues before pushing
2. **Push to GitHub** - Commit and push changes
3. **Monitor deployment** - Wait for and check deployment status
4. **Handle failures** - Use browser MCP to analyze logs and iterate
5. **Verify deployment success (REQUIRED)** - Use browser MCP to confirm deployment is Ready before completing

## Phase 1: Pre-Deployment Validation

Run these checks before any `git push`:

### 1.1 Detect Project Type

```bash
# Check for framework indicators
ls -la package.json next.config.* vite.config.* nuxt.config.* svelte.config.* astro.config.* 2>/dev/null
cat package.json | grep -E '"(next|vite|nuxt|svelte|astro|react|vue)"'
```

### 1.2 Install Dependencies and Type Check

```bash
npm install  # or yarn/pnpm based on lockfile present
npm run build 2>&1  # Capture build output for analysis
```

### 1.3 Framework-Specific Checks

See [references/framework-checks.md](references/framework-checks.md) for detailed validation per framework.

**Quick reference - common issues:**
- **Next.js**: `next lint`, check for `use client` directives, Image component imports
- **Vite/React**: ESLint, unused imports, proper Vite config for deployment
- **Environment variables**: Verify all required `NEXT_PUBLIC_*` or `VITE_*` vars exist

### 1.4 Vercel-Specific Validation

```bash
# Check vercel.json if present
cat vercel.json 2>/dev/null

# Verify build command and output directory
cat package.json | grep -A5 '"scripts"'
```

**Critical checks:**
- Build output directory matches Vercel config (`.next`, `dist`, `build`, `.output`)
- No hardcoded localhost URLs in production code
- API routes properly structured (`/api/*` for Next.js, `/api` folder for others)
- Serverless function size limits (50MB compressed for Hobby, 250MB for Pro)

### 1.5 Fix Issues Before Push

If validation finds issues:
1. Apply fixes directly to the code
2. Re-run the failed check to confirm fix
3. Stage and commit fixes: `git add -A && git commit -m "fix: pre-deployment validation fixes"`

## Phase 2: Push to GitHub

```bash
git add -A
git commit -m "deploy: [describe changes]"
git push origin [branch]
```

Capture the push output - it may contain Vercel deployment URLs.

## Phase 3: Monitor Deployment

### 3.1 Find Deployment URL

After push, Vercel creates a deployment. Get the URL via:

**Option A - GitHub commit status** (if Vercel GitHub integration active):
```bash
# Get latest commit SHA
git rev-parse HEAD

# The deployment URL follows pattern:
# https://[project-name]-[hash]-[team].vercel.app
# Or check GitHub PR/commit for Vercel bot comment
```

**Option B - Vercel Dashboard**:
Use browser MCP to navigate to `https://vercel.com/[team]/[project]/deployments`

### 3.2 Check Deployment Status

Use browser MCP to:
1. Navigate to the Vercel dashboard or deployment URL
2. Check if deployment is: Building → Ready / Error

**Wait pattern**: Deployments typically take 30s-3min. Check status every 30 seconds.

## Phase 4: Handle Deployment Failures

If deployment fails, use browser MCP for log analysis:

### 4.1 Access Build Logs

```
Navigate to: https://vercel.com/[team]/[project]/deployments/[deployment-id]
Click: "View Build Logs" or expand the failed deployment
```

### 4.2 Common Failure Patterns

See [references/common-errors.md](references/common-errors.md) for comprehensive error solutions.

**Quick fixes:**

| Error Pattern | Likely Cause | Fix |
|--------------|--------------|-----|
| `Module not found` | Missing dependency or wrong import | Check package.json, fix import path |
| `Build exceeded` | Function too large | Code split, use dynamic imports |
| `ENOENT` | Missing file reference | Check file paths, case sensitivity |
| `Type error` | TypeScript issue | Fix type, or add `// @ts-ignore` temporarily |
| `ESLint error` | Lint failure blocking build | Fix lint issue or adjust `.eslintrc` |
| `Environment variable` | Missing env var | Add to Vercel dashboard or vercel.json |

### 4.3 Iteration Loop

```
1. Read error from build logs (browser MCP)
2. Identify root cause
3. Apply fix locally
4. Run local build to verify: `npm run build`
5. If local build passes: git add, commit, push
6. Monitor new deployment
7. Repeat until success
```

## Phase 5: Verify Deployment Success (REQUIRED)

**CRITICAL: Never consider the deployment complete until this phase is done.**

After pushing changes, you MUST use the browser MCP to verify the deployment succeeded:

### 5.1 Navigate to Vercel Dashboard

1. Use `tabs_context_mcp` to get browser context (create tab if needed)
2. Navigate to the team's Vercel dashboard: `https://vercel.com/[team]`
3. If you land on a personal workspace, use the team selector dropdown to switch to the correct team

### 5.2 Check Deployment Status

1. Find the project in the dashboard
2. Click on the project to view deployment details
3. Verify the **Status** shows "Ready" (green dot)
4. Confirm the **Source** shows your commit hash and message

### 5.3 Success Criteria

The deployment is only complete when you can confirm:
- [ ] Status is "Ready" (not "Building", "Error", or "Queued")
- [ ] The commit hash matches what you pushed
- [ ] The deployment URL is accessible

### 5.4 If Deployment is Still Building

Wait 30 seconds and refresh. Deployments typically take 30s-3min. Continue checking until status changes to Ready or Error.

### 5.5 Report Results to User

Always report the final deployment status to the user:
- Deployment URL (e.g., `internal.saif.vc`)
- Status (Ready/Error)
- Commit that was deployed

## Browser MCP Usage

The browser MCP tool enables navigating Vercel's dashboard. Key actions:

```
# Navigate to deployments
mcp_browser: navigate to "https://vercel.com/[team]/[project]/deployments"

# Click on failed deployment
mcp_browser: click on deployment with "Error" status

# Read build logs
mcp_browser: extract text from build log container

# Check environment variables
mcp_browser: navigate to "https://vercel.com/[team]/[project]/settings/environment-variables"
```

**Important**: Browser MCP requires the user to be logged into Vercel in their browser session.

## Quick Command Reference

```bash
# Full pre-deployment check
npm install && npm run lint && npm run build

# Git operations
git add -A && git commit -m "message" && git push origin main

# Check for large files (Vercel limit issues)
find . -type f -size +10M -not -path './node_modules/*'

# List env vars in code
grep -r "process.env\." --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" src/
```
