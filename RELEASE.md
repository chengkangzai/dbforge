# Release Guide - Database Manager GUI

This guide explains how to create releases for the Database Manager GUI using automated GitHub Actions.

## Overview

When you push a version tag (e.g., `v1.0.1`), GitHub Actions automatically:
1. Builds executables for macOS, Windows, and Linux
2. Creates a GitHub Release draft
3. Uploads all build artifacts to the release

## Release Process

### 1. Prepare for Release

Update the version in `package.json`:
```json
{
  "version": "1.0.1"
}
```

### 2. Commit and Tag

```bash
# Commit your changes
git add .
git commit -m "Release v1.0.1

- Fix slim dump IPC communication issue
- Update dependencies for security
- Improve error handling in file operations"

# Create a version tag
git tag v1.0.1

# Push commits and tags
git push && git push --tags
```

### 3. Monitor Build

1. Visit your repository's **Actions** tab on GitHub
2. Watch the "Build and Release" workflow run
3. Each platform builds in parallel (typically takes 5-15 minutes total)

### 4. Review and Publish

1. Go to your repository's **Releases** section
2. Find the draft release created by the workflow
3. Review the generated release notes
4. Add any additional release notes or changelog
5. Click **"Publish release"** when ready

## Build Artifacts

Each release includes:

### macOS
- **File**: `Database-Manager-{version}.dmg`
- **Size**: ~190MB
- **Note**: Unsigned - users need to right-click → Open

### Windows
- **File**: `Database-Manager-Setup-{version}.exe`
- **Format**: NSIS installer
- **Note**: May trigger SmartScreen warnings (unsigned)

### Linux
- **File**: `Database-Manager-{version}.AppImage`
- **Format**: Portable AppImage
- **Usage**: `chmod +x Database-Manager-*.AppImage && ./Database-Manager-*.AppImage`

### Auto-Update Files
- `latest-mac.yml`, `latest-linux.yml`, `latest.yml`
- Used by electron-updater (if implemented in the future)

## Tag Naming Convention

Use semantic versioning with a `v` prefix:
- `v1.0.0` - Major release
- `v1.0.1` - Patch release
- `v1.1.0` - Minor release
- `v2.0.0` - Major breaking changes

## Troubleshooting

### Build Fails

**Common issues:**
1. **npm ci fails**: Check if package-lock.json is committed
2. **Vite build fails**: Check for TypeScript errors or missing dependencies
3. **Electron-builder fails**: Check electron-builder configuration in package.json

**Debug steps:**
1. Check the Actions logs for specific error messages
2. Run `npm run electron:build` locally to reproduce
3. Ensure all dependencies are properly installed

### No Artifacts in Release

**Possible causes:**
1. Build completed but artifact upload failed
2. electron-builder didn't create expected file types
3. Path patterns in workflow don't match actual output

**Debug:**
1. Check the "Upload build artifacts" step logs
2. Look for the "List build outputs" debug step
3. Verify dist/ directory contents

### Wrong Platform Builds

The workflow builds for:
- `macos-latest` → ARM64 and Intel macOS
- `windows-latest` → Windows x64
- `ubuntu-latest` → Linux x64

To build for specific architectures, modify the electron-builder config.

## Version Management

### Updating Version Number

Always update `package.json` version before tagging:
```bash
# Option 1: Manual edit
vim package.json

# Option 2: Use npm version
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.1 → 1.1.0
npm version major  # 1.1.0 → 2.0.0
```

### Pre-release Versions

For beta/alpha releases:
```bash
git tag v1.0.1-beta.1
git push --tags
```

Mark these as "pre-release" when publishing.

## Advanced Options

### Manual Release Trigger

You can also trigger builds manually:
1. Go to Actions tab
2. Select "Build and Release" workflow
3. Click "Run workflow"
4. Choose branch and enter tag name

### Build Single Platform

To build only one platform locally:
```bash
npm run electron:build -- --mac
npm run electron:build -- --win
npm run electron:build -- --linux
```

### Code Signing (Future Enhancement)

Currently builds are unsigned. To add code signing:
1. **macOS**: Apple Developer Program + certificates
2. **Windows**: Code signing certificate
3. **Linux**: No signing required

See `.github/workflows/README.md` for implementation details.

## Release Checklist

Before creating a release:

- [ ] Update version in `package.json`
- [ ] Test the application locally (`npm run electron:dev`)
- [ ] Run local build to verify (`npm run electron:build`)
- [ ] Update documentation if needed
- [ ] Commit all changes
- [ ] Create and push version tag
- [ ] Monitor GitHub Actions workflow
- [ ] Review draft release
- [ ] Add release notes
- [ ] Publish release
- [ ] Test downloaded executables on target platforms
- [ ] Announce release (if applicable)

## Support

For issues with the release process:
1. Check this documentation
2. Review GitHub Actions logs
3. Test local builds first
4. Check electron-builder documentation

---

**Next Steps**: After your first successful release, consider adding:
- Automated changelog generation
- Code signing for production distribution
- Auto-update functionality
- Beta release channels