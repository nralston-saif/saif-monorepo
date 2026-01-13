# Common Vercel Deployment Errors and Solutions

## Table of Contents
- [Build Errors](#build-errors)
- [Runtime Errors](#runtime-errors)
- [Function Errors](#function-errors)
- [Environment Variable Errors](#environment-variable-errors)
- [Dependency Errors](#dependency-errors)
- [Configuration Errors](#configuration-errors)

---

## Build Errors

### Module not found: Can't resolve 'X'

**Cause**: Missing dependency or incorrect import path

**Solutions**:
```bash
# Check if package exists
npm list [package-name]

# If missing, install it
npm install [package-name]

# If it's a path issue, check case sensitivity (Linux is case-sensitive)
find . -iname "*filename*" -not -path "./node_modules/*"
```

### Type error: X is not assignable to Y

**Cause**: TypeScript type mismatch

**Solutions**:
```bash
# Quick fix - add type assertion or ignore (temporary)
// @ts-ignore or // @ts-expect-error

# Proper fix - correct the types
# Run: npx tsc --noEmit to see all type errors
```

### ESLint: X error(s)

**Cause**: ESLint rules blocking build

**Solutions**:
```bash
# Fix automatically where possible
npm run lint -- --fix

# For rules that can't be auto-fixed, either:
# 1. Fix manually
# 2. Disable rule in .eslintrc for that file
# 3. Add eslint-disable comment
```

### Build exceeded maximum size

**Cause**: Output bundle too large (>50MB hobby, >250MB pro)

**Solutions**:
```javascript
// 1. Use dynamic imports
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Loading...</p>
})

// 2. Analyze bundle
// Add to package.json scripts:
"analyze": "ANALYZE=true next build"

// 3. Check for accidentally bundled large files
```

```bash
# Find large files
find . -type f -size +1M -not -path "./node_modules/*" -not -path "./.git/*"

# Check node_modules size
du -sh node_modules/*/  | sort -h | tail -20
```

---

## Runtime Errors

### Error: ENOENT: no such file or directory

**Cause**: File path doesn't exist at runtime

**Solutions**:
```bash
# Check file exists and path is correct
ls -la [path]

# Common issues:
# - Case sensitivity: 'File.tsx' vs 'file.tsx'
# - Missing file in git (check .gitignore)
# - Wrong relative path
```

### Error: Cannot read property 'X' of undefined

**Cause**: Accessing property on null/undefined value

**Solutions**:
```javascript
// Add optional chaining
data?.property?.nested

// Add null checks
if (data && data.property) { ... }

// Add default values
const value = data?.property ?? 'default'
```

### Hydration mismatch

**Cause**: Server HTML doesn't match client render

**Solutions**:
```javascript
// 1. Use useEffect for client-only code
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])
if (!mounted) return null

// 2. Use dynamic import with ssr: false
const ClientOnly = dynamic(() => import('./Component'), { ssr: false })

// 3. Suppress hydration warning (last resort)
<div suppressHydrationWarning>...</div>
```

---

## Function Errors

### FUNCTION_INVOCATION_TIMEOUT

**Cause**: Serverless function exceeded time limit (10s hobby, 60s pro)

**Solutions**:
```javascript
// 1. Optimize slow operations
// 2. Add caching
// 3. Use background jobs for long tasks
// 4. Increase timeout in vercel.json:
{
  "functions": {
    "api/*.js": {
      "maxDuration": 30
    }
  }
}
```

### Edge Function Exceeded Size Limit

**Cause**: Edge function > 1MB

**Solutions**:
```bash
# Move to serverless function instead of edge
# or reduce dependencies
```

### FUNCTION_PAYLOAD_TOO_LARGE

**Cause**: Request/response body > 4.5MB

**Solutions**:
```javascript
// Stream large responses
// Use external storage (S3, etc) for large files
// Paginate data
```

---

## Environment Variable Errors

### ReferenceError: process is not defined

**Cause**: Using process.env in browser without NEXT_PUBLIC_ prefix

**Solutions**:
```javascript
// For Next.js, prefix with NEXT_PUBLIC_
NEXT_PUBLIC_API_URL=https://api.example.com

// For Vite, use VITE_ prefix and import.meta.env
VITE_API_URL=https://api.example.com
```

### Environment variable is undefined

**Cause**: Env var not set in Vercel

**Solutions**:
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add the variable for correct environments (Production/Preview/Development)
3. Redeploy after adding

```bash
# List all env vars used in codebase
grep -rn "process.env\." --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . | grep -v node_modules
grep -rn "import.meta.env\." --include="*.ts" --include="*.tsx" . | grep -v node_modules
```

---

## Dependency Errors

### peer dependency conflict

**Cause**: Incompatible package versions

**Solutions**:
```bash
# Option 1: Use legacy peer deps
npm install --legacy-peer-deps

# Option 2: Force install
npm install --force

# Option 3: Fix versions in package.json
```

### Cannot find module 'X' (at runtime)

**Cause**: Package in devDependencies but needed at runtime

**Solutions**:
```bash
# Move from devDependencies to dependencies
npm install [package] --save
```

### Package subpath './X' is not defined

**Cause**: ESM/CJS module resolution issue

**Solutions**:
```javascript
// 1. Check package exports in node_modules/[pkg]/package.json
// 2. Try different import syntax:
import pkg from 'package'  // vs
import { something } from 'package/subpath'

// 3. Add to next.config.js transpilePackages
transpilePackages: ['package-name']
```

---

## Configuration Errors

### Invalid vercel.json

**Cause**: Syntax or schema error in vercel.json

**Solutions**:
```bash
# Validate JSON syntax
cat vercel.json | python3 -m json.tool

# Check against schema
# Common issues:
# - Trailing commas
# - Wrong field names
# - Incorrect nesting
```

### Build command not found

**Cause**: Missing or incorrect build script

**Solutions**:
```json
// package.json must have:
{
  "scripts": {
    "build": "next build"  // or vite build, etc.
  }
}
```

### Output directory not found

**Cause**: Build output in unexpected location

**Solutions**:
```bash
# Check where build outputs
npm run build
ls -la .next/ dist/ build/ .output/

# Configure in vercel.json if non-standard
{
  "outputDirectory": "dist"
}
```
