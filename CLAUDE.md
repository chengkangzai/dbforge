# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Development Commands

- **Start development**: `npm run electron:dev` (runs Vite dev server + Electron with hot reload)
- **Build for production**: `npm run electron:build` (creates distributable for current platform)
- **Start Vite only**: `npm run dev` (Vite dev server on http://localhost:5173)
- **Build web assets**: `npm run build` (Vite production build to dist/)
- **Preview build**: `npm run preview` (serve production build)
- **Run Electron only**: `npm run electron` (launch Electron without dev server)

### Platform-Specific Builds

- **macOS**: `npm run electron:build -- --mac`
- **Windows**: `npm run electron:build -- --win`
- **Linux**: `npm run electron:build -- --linux`
- **All platforms**: `npm run electron:build -- --mac --win --linux`

### Troubleshooting Commands

- **Clear cache**: `rm -rf node_modules package-lock.json && npm install`
- **Clear Electron cache**: `rm -rf ~/Library/Caches/electron ~/Library/Application\ Support/electron`
- **Check dependencies**: `npm audit && npm outdated`

## Architecture Overview

### Electron + React + Vite Desktop Application

This is a desktop database management tool built with modern web technologies wrapped in Electron. The application provides a GUI interface for MySQL database operations that were previously CLI-only.

### Core Architecture Pattern: Main + Renderer Separation

**Main Process (Node.js/Electron)**
- **Location**: `electron/` directory
- **Responsibilities**: File system access, MySQL operations, system integration
- **Security**: Full Node.js access, handles all database operations
- **Communication**: IPC handlers expose safe APIs to renderer

**Renderer Process (React)**
- **Location**: `src/` directory
- **Responsibilities**: User interface only, no direct system access
- **Security**: Context isolated, sandboxed environment
- **Communication**: Uses `window.dbManager` API via preload script

**Shared Business Logic**
- **Location**: `lib/` directory (copied from CLI tool)
- **Usage**: Imported only by main process
- **Pattern**: Pure functions for database and file operations

### Security Architecture

```javascript
// Secure IPC communication pattern
webPreferences: {
    nodeIntegration: false,        // No Node.js in renderer
    contextIsolation: true,        // Isolated context
    sandbox: false,                // Main process needs full access
    preload: 'electron/preload.cjs' // Secure bridge
}
```

The preload script (`electron/preload.cjs`) exposes a limited API via `contextBridge`, ensuring the renderer cannot access Node.js directly.

### State Management Pattern

**React Context for UI State**
- `src/contexts/OperationContext.jsx` - Tracks active operations
- Prevents UI conflicts when operations are running
- Simple provider pattern for operation state

**Electron Store for Settings**
- `electron/settings.js` - Persistent app configuration
- `electron-store` package for settings persistence
- Stores MySQL connection and database directory settings

**No Global State Library**
- Application is simple enough to avoid Redux/Zustand
- Local component state + context for coordination
- Settings handled by Electron main process

### Database Operations Architecture

**MySQL Connection Management**
- `lib/mysql.js` - Connection pooling and query execution
- Configuration injected from electron-store settings
- Automatic reconnection and error handling

**Operation Modules** (all in `lib/`)
- `restore.js` - Database restoration from SQL dumps
- `slim.js` - Create reduced dumps excluding large tables
- `snapshot.js` - Backup local databases with descriptions
- `file-*.js` - File management operations (rename, replace, delete)

**Progress Tracking**
- IPC events for real-time progress updates
- Main process emits progress events during long operations
- React components listen and update UI accordingly

### File Organization Strategy

**SQL File Categories**
- `full/` - Complete database dumps
- `slim/` - Reduced dumps excluding configured tables
- `snapshots/` - Local database backups with descriptions
- `config/exclude-tables.txt` - Tables to exclude from slim dumps

**Configuration Management**
- First-run wizard collects MySQL + directory settings
- Settings persisted in OS-appropriate location via electron-store
- Configurable exclude tables list for slim dump generation

## Key Development Patterns

### IPC Communication Pattern

**Main Process Handler Registration**
```javascript
// electron/ipc-handlers.js
ipcMain.handle('mysql:test-connection', async (event, config) => {
    ensureMySQLConfig();
    return await testConnection(config);
});
```

**Renderer Process Usage**
```javascript
// src/components/*.jsx
const result = await window.dbManager.testConnection(config);
```

**Progress Event Pattern**
```javascript
// Main: Emit progress during operations
event.sender.send('operation:progress', { current: 50, total: 100 });

// Renderer: Listen for progress updates
useEffect(() => {
    return window.dbManager.onProgress((progress) => {
        setProgress(progress);
    });
}, []);
```

### Component Architecture

**Feature-Based Component Organization**
- Each major operation has its own component (`Restore.jsx`, `Slim.jsx`, etc.)
- Shared UI elements in reusable components (`SearchableDropdown.jsx`)
- Consistent loading states and error handling patterns

**Form Management Pattern**
```javascript
const [formData, setFormData] = useState({});
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState('');

const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
        await window.dbManager.performOperation(formData);
    } catch (err) {
        setError(err.message);
    } finally {
        setIsLoading(false);
    }
};
```

### Dark Theme Development Pattern

**Tailwind Configuration**
- Custom dark color palette in `tailwind.config.js`
- Developer-friendly colors (dark blue/slate theme)
- Monospace font family for technical UI elements

**UI Consistency**
- `dark:` prefixes for theme-aware styling
- Consistent spacing and typography scale
- Loading spinners and progress indicators

### File System Integration

**Directory Structure Management**
- Automatic creation of required directories
- Permission checking and error handling
- Cross-platform path handling via Node.js path module

**File Discovery and Metadata**
```javascript
// Discover SQL files in categorized directories
const files = await discoverSqlFiles(databaseDir, category);

// Extract database name from filename patterns
const dbName = getDatabaseNameFromFile(filename);

// Get file size and modification date
const fileInfo = await getFileInfo(filepath);
```

## Critical Development Requirements

### When Working on IPC Communication

1. **Always validate inputs** in main process handlers
2. **Never expose Node.js APIs** directly to renderer
3. **Use contextBridge** for all main-to-renderer communication
4. **Handle errors gracefully** - return error objects, don't throw
5. **Emit progress events** for long-running operations

### When Adding New Database Operations

1. **Create lib module first** with pure functions
2. **Add IPC handler** in `electron/ipc-handlers.js`
3. **Expose via preload** in secure contextBridge API
4. **Create React component** that uses the exposed API
5. **Add to navigation** in `Sidebar.jsx`

### When Modifying MySQL Operations

1. **Test with real databases** - never mock in development
2. **Handle connection failures** gracefully
3. **Support socket and TCP** connection methods
4. **Validate SQL file format** before operations
5. **Provide clear error messages** to users

### When Building for Distribution

1. **Test on clean systems** without development tools
2. **Verify first-run wizard** works correctly
3. **Check settings persistence** across app restarts
4. **Test MySQL connection** with various configurations
5. **Validate file operations** in user directories

## Environment Requirements

### Development Setup
- **Node.js**: 18+ (uses ES modules)
- **MySQL**: Local or network accessible MySQL server
- **Platform**: macOS, Windows, or Linux for development
- **RAM**: 8GB+ recommended for Electron development

### MySQL Configuration
- **Access**: CREATE, DROP, SELECT, INSERT privileges required
- **Connection**: TCP/IP or Unix socket support
- **Encoding**: UTF-8 support for SQL file imports
- **Storage**: Sufficient space for database operations

### Build Requirements
- **Disk Space**: 2GB+ for node_modules and builds
- **Platform-specific**: Native tools for target platform builds
- **Signing**: Developer certificates for production distribution

## Security Considerations

### Electron Security Model
- **Context isolation** prevents renderer access to Node.js
- **Sandboxed renderer** cannot access file system directly
- **IPC validation** ensures safe parameter passing
- **No remote module** usage for security

### MySQL Security
- **Connection credentials** stored in encrypted electron-store
- **SQL injection prevention** via parameterized queries
- **Limited privileges** recommended for database user
- **Local connections** preferred over network when possible

### File System Security
- **Directory permissions** validated before operations
- **Path traversal prevention** in file operations
- **User directory access** only, no system file access
- **File type validation** for SQL imports

## Build and Distribution Notes

### Current Build Status
- **macOS**: Successfully builds ARM64 DMG (191MB)
- **Code Signing**: Not configured (requires Apple Developer account)
- **Windows/Linux**: Available but not tested in current setup
- **Installation**: First-run wizard handles user setup

### Distribution Considerations
- **Unsigned apps** require user security bypass on macOS
- **File associations** not configured (users drag/drop SQL files)
- **Auto-updates** not implemented
- **Error reporting** uses console logs, no telemetry

### Known Technical Debt

Based on existing documentation:

1. **Dependency Updates Needed**
   - Security vulnerabilities in Electron < 39.0.0
   - Deprecated packages from electron-builder dependencies
   - Update plan documented in `UPDATE_ACTION_PLAN.md`

2. **Potential Improvements**
   - Replace `cli-progress` with `electron-progressbar` for better UX
   - Add TypeScript for better development experience
   - Consider React 19 migration (plan in `DEPENDENCY_ANALYSIS.md`)

3. **Distribution Improvements**
   - Code signing for macOS/Windows production releases
   - Auto-updater implementation
   - Better error reporting and logging

## Testing Strategy

### Manual Testing Required
- **Database operations** with real MySQL instances
- **File operations** with various SQL dump formats
- **Cross-platform** build and installation testing
- **First-run wizard** on clean systems
- **Settings persistence** across app restarts

### Regression Testing Areas
- MySQL connection with various configurations (TCP/socket)
- SQL file discovery and metadata extraction
- Progress reporting during long operations
- Error handling and user feedback
- Directory creation and permission handling

## Common Development Scenarios

### Adding a New Database Operation

1. Create function in appropriate `lib/` module
2. Add IPC handler in `electron/ipc-handlers.js`
3. Expose in `electron/preload.cjs`
4. Create React component in `src/components/`
5. Add navigation link in `Sidebar.jsx`
6. Test with real databases

### Debugging IPC Issues

1. Check DevTools console in renderer process
2. Check main process console (VS Code terminal)
3. Verify preload script exposes expected APIs
4. Test IPC handlers independently
5. Validate parameter serialization across process boundary

### Handling MySQL Connection Problems

1. Test connection in Settings page first
2. Verify MySQL server is running and accessible
3. Check credentials and permissions
4. Try socket path vs TCP connection
5. Review error messages in UI and console