# GitHub Actions Workflows

This directory contains automated workflows for the Database Manager GUI project.

## Workflows

### `build-release.yml` - Build and Release

Automatically builds production executables when a version tag is pushed.

#### Trigger
```yaml
on:
  push:
    tags:
      - 'v*.*.*'  # Matches v1.0.0, v2.1.3, etc.
```

#### Build Matrix
The workflow builds on three platforms simultaneously:
- **macOS Latest**: Creates `.dmg` installer
- **Windows Latest**: Creates `.exe` NSIS installer
- **Ubuntu Latest**: Creates `.AppImage` portable app

#### Workflow Structure

```
Tag Push (v1.0.1)
    ↓
┌─────────────────┬─────────────────┬─────────────────┐
│   macOS Build   │  Windows Build  │   Linux Build   │
│                 │                 │                 │
│ 1. Checkout     │ 1. Checkout     │ 1. Checkout     │
│ 2. Node.js 20   │ 2. Node.js 20   │ 2. Node.js 20   │
│ 3. npm ci       │ 3. npm ci       │ 3. npm ci       │
│ 4. vite build   │ 4. vite build   │ 4. vite build   │
│ 5. electron     │ 5. electron     │ 5. electron     │
│    builder      │    builder      │    builder      │
│ 6. Upload       │ 6. Upload       │ 6. Upload       │
│    artifacts    │    artifacts    │    artifacts    │
└─────────────────┴─────────────────┴─────────────────┘
                            ↓
                    Create GitHub Release
                    (Draft with all artifacts)
```

## Environment Variables

The workflow uses these environment variables:

### `GITHUB_TOKEN`
- **Source**: Automatically provided by GitHub Actions
- **Purpose**: Upload artifacts to GitHub Releases
- **Scope**: Read/write access to repository

### Build Environment
- **Node.js**: Version 20 (LTS)
- **npm**: Latest (comes with Node.js)
- **OS Runners**:
  - `macos-latest`: macOS 12+ (ARM64 and Intel)
  - `windows-latest`: Windows Server 2022
  - `ubuntu-latest`: Ubuntu 22.04

## Artifact Handling

### Build Outputs
Each platform creates specific files in the `dist/` directory:

```bash
dist/
├── Database-Manager-1.0.1.dmg           # macOS installer
├── Database-Manager-Setup-1.0.1.exe     # Windows installer
├── Database-Manager-1.0.1.AppImage      # Linux portable app
├── latest-mac.yml                       # macOS auto-update metadata
├── latest-linux.yml                     # Linux auto-update metadata
└── latest.yml                           # Windows auto-update metadata
```

### Artifact Upload
- **Action**: `actions/upload-artifact@v4`
- **Retention**: 30 days
- **Names**: `mac-build`, `win-build`, `linux-build`

### Release Creation
- **Action**: `softprops/action-gh-release@v1`
- **Type**: Draft release (manual publish required)
- **Assets**: All platform executables + metadata files

## Configuration Details

### Package.json Scripts

The workflow uses these npm scripts:
```json
{
  "build": "vite build",              // Build web assets
  "electron:build": "vite build && electron-builder",  // Local builds
  "release": "vite build && electron-builder --publish always"  // CI builds
}
```

### Electron-Builder Configuration

The workflow relies on the electron-builder config in `package.json`:
```json
{
  "build": {
    "appId": "com.dbmanager.gui",
    "productName": "Database Manager",
    "files": ["dist/**/*", "electron/**/*", "lib/**/*"],
    "mac": {
      "target": "dmg",
      "category": "public.app-category.developer-tools"
    },
    "win": {
      "target": "nsis"
    },
    "linux": {
      "target": "AppImage",
      "category": "Development"
    }
  }
}
```

## Debugging

### View Workflow Logs
1. Go to repository → Actions tab
2. Click on the workflow run
3. Expand each job to see detailed logs

### Debug Steps in Workflow

The workflow includes debug output:
```yaml
- name: List build outputs (debug)
  run: |
    echo "Contents of dist directory:"
    ls -la dist/ || echo "No dist directory"
```

### Common Issues

**Build Failure**:
- Check step logs for specific errors
- Verify package.json scripts work locally
- Ensure all dependencies are in package-lock.json

**No Artifacts**:
- Check dist/ directory contents in debug step
- Verify electron-builder configuration
- Check artifact upload step logs

**Release Not Created**:
- Verify tag format matches `v*.*.*` pattern
- Check GITHUB_TOKEN permissions
- Review release creation step logs

## Customization

### Adding Platforms
To build for additional platforms:
```yaml
strategy:
  matrix:
    include:
      - os: macos-latest
        platform: mac
        arch: x64
      - os: macos-latest
        platform: mac
        arch: arm64
```

### Changing Node.js Version
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '18'  # or '20', '21'
```

### Adding Code Signing

For production releases, add code signing:

#### macOS Signing
```yaml
- name: Import Code-Signing Certificates
  uses: Apple-Actions/import-codesign-certs@v1
  with:
    p12-file-base64: ${{ secrets.APPLE_CERT_DATA }}
    p12-password: ${{ secrets.APPLE_CERT_PASSWORD }}

- name: Build and Sign
  run: npm run release
  env:
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_ID_PASS: ${{ secrets.APPLE_ID_PASS }}
    CSC_LINK: ${{ secrets.APPLE_CERT_DATA }}
    CSC_KEY_PASSWORD: ${{ secrets.APPLE_CERT_PASSWORD }}
```

#### Windows Signing
```yaml
- name: Build and Sign
  run: npm run release
  env:
    CSC_LINK: ${{ secrets.WIN_CERT_FILE }}
    CSC_KEY_PASSWORD: ${{ secrets.WIN_CERT_PASSWORD }}
```

### Auto-Update Configuration

To enable auto-updates, add to electron-builder config:
```json
{
  "publish": {
    "provider": "github",
    "owner": "your-username",
    "repo": "db-manager-gui"
  }
}
```

## Secrets Management

For enhanced workflows, add these repository secrets:

**Settings → Secrets and variables → Actions**

### Code Signing
- `APPLE_CERT_DATA` - Base64 encoded .p12 certificate
- `APPLE_CERT_PASSWORD` - Certificate password
- `APPLE_ID` - Apple ID email
- `APPLE_ID_PASS` - App-specific password
- `WIN_CERT_FILE` - Windows code signing certificate
- `WIN_CERT_PASSWORD` - Certificate password

### Notifications
- `SLACK_WEBHOOK` - For build notifications
- `DISCORD_WEBHOOK` - For release announcements

## Performance Optimizations

### Caching
The workflow caches npm dependencies:
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'  # Caches ~/.npm directory
```

### Parallel Builds
All three platforms build simultaneously, reducing total build time from ~45 minutes to ~15 minutes.

### Artifact Efficiency
Only uploads necessary files, keeping artifact size minimal.

## Monitoring

### Build Times
Typical build duration by platform:
- **macOS**: 8-12 minutes (DMG creation is slow)
- **Windows**: 5-8 minutes
- **Linux**: 3-5 minutes (fastest)

### GitHub Actions Usage
- **Public repos**: Unlimited minutes
- **Private repos**: 2,000 free minutes/month
- **Cost per build**: ~20-30 minutes total

---

## Future Enhancements

Consider adding:
1. **Pre-release builds** for branches
2. **Automated changelog** generation
3. **Dependency vulnerability** scanning
4. **Performance benchmarks**
5. **Cross-platform testing** before release
6. **Notification integrations** (Slack, Discord)
7. **Beta/alpha release** channels

For implementation details, refer to GitHub Actions documentation and electron-builder guides.