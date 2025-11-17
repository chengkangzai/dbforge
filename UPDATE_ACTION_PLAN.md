# Quick Action Plan - Dependency Updates

## TL;DR

Update these packages to fix security issues and deprecated dependencies:

```bash
# Phase 1: Security Fixes (DO NOW)
npm install --save-dev electron@39.0.0 vite@7.1.12 @vitejs/plugin-react@5.1.0

# Phase 2: Fix Deprecated Dependencies (DO SOON)
npm install --save-dev electron-builder@26.0.12

# Phase 3: React 19 (DO LATER)
npm install react@19.2.0 react-dom@19.2.0
```

---

## Phase 1: Security Fixes (Priority: CRITICAL)

**Time**: 2-4 hours
**When**: This week

### Commands

```bash
# Update packages
npm install --save-dev electron@39.0.0 vite@7.1.12 @vitejs/plugin-react@5.1.0

# Test
npm run dev
npm run electron:dev
npm run build
npm run electron:build
```

### What This Fixes

- ✅ Electron ASAR integrity bypass vulnerability (moderate)
- ✅ esbuild development server request bypass (moderate)
- ✅ Updates to latest stable versions

### Testing Checklist

- [ ] `npm run dev` - Vite dev server starts
- [ ] `npm run electron:dev` - Electron window opens
- [ ] Hot reload works in Electron window
- [ ] `npm run build` - Production build succeeds
- [ ] `npm run electron:build` - Creates installer
- [ ] Installer works and app launches
- [ ] Database connections work (mysql2)
- [ ] All UI features functional

---

## Phase 2: Deprecated Dependencies (Priority: HIGH)

**Time**: 4-8 hours
**When**: Within 1-2 weeks

### Commands

```bash
# Update electron-builder
npm install --save-dev electron-builder@26.0.12

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Test builds
npm run electron:build
```

### What This Fixes

- ✅ Removes npmlog, gauge, are-we-there-yet warnings
- ✅ Removes @npmcli/move-file warning
- ✅ Updates to glob v9+ (removes inflight memory leak)
- ✅ Updates rimraf to v4+
- ⚠️ boolean@3.2.0 still present (from Electron, will fix in Electron v40+)

### Testing Checklist

- [ ] Build for macOS (if applicable)
- [ ] Build for Windows (if applicable)
- [ ] Build for Linux (if applicable)
- [ ] Install and test app from installer
- [ ] Code signing/notarization still works (if configured)

### Expected Warnings After This Phase

```
npm warn deprecated boolean@3.2.0: Package no longer supported.
```

This is from Electron itself, not electron-builder. Will be fixed in future Electron releases.

---

## Phase 3: React 19 Migration (Priority: MEDIUM)

**Time**: 8-16 hours
**When**: Within 1-2 months

### Step 1: Upgrade to React 18.3 (Preparation)

```bash
npm install react@18.3 react-dom@18.3
npm test  # Run your test suite
npm run dev
```

React 18.3 adds warnings for React 19 incompatibilities.

### Step 2: Run Codemods

```bash
npx codemod react/19/migration-recipe
```

This automatically updates common patterns:
- Converts `createFactory()` calls to JSX
- Updates `act()` imports
- Identifies potential issues

### Step 3: Upgrade to React 19

```bash
npm install react@19.2.0 react-dom@19.2.0
```

### Step 4: Manual Updates

Check your code for:

1. **forwardRef** - Now unnecessary:
   ```javascript
   // Old (React 18)
   const MyInput = forwardRef((props, ref) => {
     return <input ref={ref} {...props} />;
   });

   // New (React 19)
   function MyInput({ ref, ...props }) {
     return <input ref={ref} {...props} />;
   }
   ```

2. **act() imports** - Moved package:
   ```javascript
   // Old
   import { act } from 'react-dom/test-utils';

   // New
   import { act } from 'react';
   ```

3. **New Hooks** (Optional):
   - `useActionState` - For form state management
   - `useFormStatus` - For form submission status

### Testing Checklist

- [ ] All components render correctly
- [ ] No console errors or warnings
- [ ] Forms work correctly
- [ ] Routing works (if using react-router-dom)
- [ ] State management works
- [ ] Effects run as expected
- [ ] Run full test suite (if you have tests)

### React Router Update (Optional)

If you want to update react-router-dom to v7:

```bash
npm install react-router-dom@7.9.5
```

⚠️ **Warning**: v7 has breaking changes. Review [upgrade guide](https://reactrouter.com/en/main/upgrading/v6) first.

**Recommendation**: Update React 19 first, then update React Router separately.

---

## Optional: Other Package Updates

### Low-Risk Updates

```bash
npm install ora@9.0.0 wait-on@9.0.1
```

These are development dependencies with minimal breaking changes.

### High-Risk Updates (NOT RECOMMENDED NOW)

```bash
# Tailwind CSS v4 - Major rewrite, significant breaking changes
npm install tailwindcss@4.1.16  # ❌ Don't do this yet

# React Router v7 - Significant routing API changes
npm install react-router-dom@7.9.5  # ⚠️ Do after React 19 if needed
```

---

## Alternative: electron-progressbar

Currently using `cli-progress` (terminal-based). For better Electron UX:

```bash
npm install electron-progressbar
npm uninstall cli-progress
```

### Usage Example

```javascript
// electron/main.js
const ProgressBar = require('electron-progressbar');

const progressBar = new ProgressBar({
  text: 'Preparing data...',
  detail: 'Wait...'
});

progressBar
  .on('completed', () => {
    console.log('Process completed');
    progressBar.detail = 'Task completed. Exiting...';
  })
  .on('aborted', () => {
    console.log('Process aborted');
  });

// Update progress
progressBar.value = 50;
progressBar.detail = 'Half way there...';
```

Or use native API:

```javascript
// In main process
mainWindow.setProgressBar(0.5);  // 50%
mainWindow.setProgressBar(-1);   // Hide progress
```

---

## Troubleshooting

### Issue: Electron won't start after update

```bash
# Clear Electron cache
rm -rf ~/Library/Caches/electron
rm -rf ~/Library/Application\ Support/electron

# Reinstall
npm ci
```

### Issue: Build fails with electron-builder v26

Check your `package.json` build configuration. Common issues:
- Outdated signing configuration
- Missing files in `files` array
- Platform-specific settings

### Issue: Vite HMR not working in Electron

Ensure your electron main.js loads from the correct URL:

```javascript
if (process.env.NODE_ENV === 'development') {
  mainWindow.loadURL('http://localhost:5173');
} else {
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}
```

### Issue: React 19 component errors

Look for:
- `forwardRef` usage (can be removed)
- String refs (deprecated in v16, removed in v19)
- Legacy context API (use Context API from v16.3+)

---

## Verification Commands

After each phase, run:

```bash
# Check for vulnerabilities
npm audit

# Check for outdated packages
npm outdated

# List dependency tree for specific package
npm list electron-builder
npm list react
```

---

## Rollback Commands

If something breaks:

### Rollback Phase 1
```bash
npm install --save-dev electron@32.3.3 vite@5.4.21 @vitejs/plugin-react@4.7.0
```

### Rollback Phase 2
```bash
npm install --save-dev electron-builder@25.1.8
```

### Rollback Phase 3
```bash
npm install react@18.3.1 react-dom@18.3.1
```

---

## Timeline Recommendation

| Week | Phase | Effort | Risk |
|------|-------|--------|------|
| 1 | Phase 1: Security | 2-4 hrs | Low |
| 2-3 | Phase 2: electron-builder | 4-8 hrs | Medium |
| 4-8 | Phase 3: React 19 | 8-16 hrs | Medium |

**Total**: ~14-28 hours over 8 weeks

---

## Success Criteria

### After Phase 1
- ✅ Zero security vulnerabilities in `npm audit`
- ✅ Electron v39 and Vite v7 working
- ✅ All app features functional

### After Phase 2
- ✅ Only 1 deprecation warning (boolean@3.2.0)
- ✅ Builds work on all target platforms
- ✅ No glob, rimraf, npmlog, gauge warnings

### After Phase 3
- ✅ React 19 running without errors
- ✅ No console warnings
- ✅ All components working
- ✅ Forms and state management functional

---

## Questions?

See `DEPENDENCY_ANALYSIS.md` for detailed explanations of:
- Why these packages are deprecated
- Security vulnerability details
- Migration guides and best practices
- Alternative package recommendations
- Electron + React + Vite best practices (2024-2025)
