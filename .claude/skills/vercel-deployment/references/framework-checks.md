# Framework-Specific Validation Checks

## Table of Contents
- [Next.js](#nextjs)
- [Vite / React](#vite--react)
- [Nuxt](#nuxt)
- [SvelteKit](#sveltekit)
- [Astro](#astro)
- [Generic Node.js](#generic-nodejs)

---

## Next.js

### Required Checks

```bash
# Run Next.js lint
npx next lint

# Build to catch SSR/SSG issues
npm run build

# Check for proper client/server boundaries
grep -rn "use client" --include="*.tsx" --include="*.jsx" src/ app/ 2>/dev/null
grep -rn "use server" --include="*.tsx" --include="*.jsx" src/ app/ 2>/dev/null
```

### Common Issues

**1. Missing 'use client' directive**
```
Error: useState/useEffect only works in Client Components
Fix: Add 'use client' at top of component file
```

**2. Image component issues**
```bash
# Check for next/image usage
grep -rn "from ['\"]next/image['\"]" --include="*.tsx" --include="*.jsx"

# Verify next.config.js has image domains if using external images
cat next.config.* | grep -A10 "images"
```

**3. Dynamic imports for client-only libraries**
```javascript
// Wrong - will fail SSR
import SomeClientLib from 'client-only-lib'

// Correct
import dynamic from 'next/dynamic'
const SomeClientLib = dynamic(() => import('client-only-lib'), { ssr: false })
```

**4. App Router specific**
```bash
# Check for proper file structure
ls -la app/
# Should have: layout.tsx, page.tsx at minimum

# Verify metadata exports
grep -rn "export const metadata" --include="*.tsx" app/
```

### Environment Variables

```bash
# List all NEXT_PUBLIC_ vars used
grep -rn "NEXT_PUBLIC_" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" .

# Compare with .env files
cat .env* 2>/dev/null | grep "NEXT_PUBLIC_"
```

---

## Vite / React

### Required Checks

```bash
# TypeScript check
npx tsc --noEmit

# ESLint
npm run lint

# Build
npm run build
```

### Common Issues

**1. Vite config for production**
```javascript
// vite.config.ts must have proper base if not at root
export default defineConfig({
  base: '/', // or '/subpath/' if deployed to subpath
})
```

**2. Environment variables**
```bash
# Vite uses VITE_ prefix
grep -rn "import.meta.env.VITE_" --include="*.ts" --include="*.tsx" .

# Check .env files
cat .env* 2>/dev/null | grep "VITE_"
```

**3. Build output**
```bash
# Verify dist folder structure after build
ls -la dist/
# Should contain: index.html, assets/
```

---

## Nuxt

### Required Checks

```bash
# Type check
npx nuxi typecheck

# Build
npm run build
```

### Common Issues

**1. Auto-imports**
```bash
# Verify components are in correct folders
ls -la components/ composables/ utils/
```

**2. Server routes**
```bash
# Check server/api structure
ls -la server/api/
```

**3. Nitro preset**
```javascript
// nuxt.config.ts - Vercel preset is auto-detected
// but can be explicit:
export default defineNuxtConfig({
  nitro: {
    preset: 'vercel'
  }
})
```

---

## SvelteKit

### Required Checks

```bash
# Check
npm run check

# Build
npm run build
```

### Common Issues

**1. Adapter configuration**
```javascript
// svelte.config.js must use Vercel adapter
import adapter from '@sveltejs/adapter-vercel';

export default {
  kit: {
    adapter: adapter()
  }
};
```

**2. Install adapter**
```bash
npm install @sveltejs/adapter-vercel
```

---

## Astro

### Required Checks

```bash
# Check
npm run astro check

# Build
npm run build
```

### Common Issues

**1. Output mode**
```javascript
// astro.config.mjs
export default defineConfig({
  output: 'server', // or 'hybrid' for SSR
  adapter: vercel()
});
```

**2. Install adapter**
```bash
npm install @astrojs/vercel
```

---

## Generic Node.js

### Required Checks

```bash
# Install deps
npm install

# Run tests if present
npm test 2>/dev/null || echo "No tests configured"

# Check for TypeScript
if [ -f "tsconfig.json" ]; then
  npx tsc --noEmit
fi
```

### Common Issues

**1. Node version**
```bash
# Check .nvmrc or engines in package.json
cat .nvmrc 2>/dev/null
cat package.json | grep -A3 '"engines"'

# Vercel defaults: Node 18.x or 20.x
```

**2. Build command**
```bash
# package.json must have build script
cat package.json | grep '"build"'
```
