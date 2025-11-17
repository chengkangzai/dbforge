# Database Manager GUI

A powerful Electron-based desktop application for managing MySQL databases. Features include database restoration from SQL dumps, creating slim dumps by excluding large tables, snapshot management, bulk database deletion, and file organization.

## Features

- **Restore Database** - Import SQL dumps (full, slim, or snapshots)
- **Create Slim Dumps** - Generate reduced dumps by excluding configured tables (~70% smaller)
- **Create Snapshots** - Backup local databases with custom descriptions
- **Delete Databases** - Bulk delete databases with pattern matching (`*`, `?` wildcards)
- **Manage Files** - Rename, replace, or delete SQL files
- **Settings** - Configure MySQL connection and database directory
- **First-Run Wizard** - Guided setup for MySQL and directory configuration

## System Requirements

### macOS
- macOS 10.12 (Sierra) or later
- MySQL server running locally or accessible via network

### Windows
- Windows 10 or later
- MySQL server installed

### Linux
- 64-bit distribution
- MySQL server installed

## Tech Stack

- **Electron 32** - Desktop framework
- **React 18** - UI library
- **React Router 6** - Navigation
- **Vite 5** - Fast build tool & dev server
- **Tailwind CSS 3** - Utility-first styling
- **mysql2** - MySQL client
- **electron-store** - Settings persistence
- **Shared Library** - Reuses logic from CLI tool

## Installation

### For End Users

Download the appropriate installer for your platform from the Releases page:

#### macOS
1. Download `Database Manager-1.0.0-arm64.dmg` (Apple Silicon) or `Database Manager-1.0.0-x64.dmg` (Intel)
2. Open the DMG file
3. Drag the application to your Applications folder
4. Open the application (you may need to right-click and select "Open" the first time due to Gatekeeper)

#### Windows
1. Download `Database Manager Setup 1.0.0.exe`
2. Run the installer
3. Follow the installation wizard
4. Launch from the Start Menu

#### Linux
1. Download `Database Manager-1.0.0.AppImage`
2. Make it executable: `chmod +x Database\ Manager-1.0.0.AppImage`
3. Run: `./Database\ Manager-1.0.0.AppImage`

### For Developers

Prerequisites:
- Node.js 18+
- MySQL running locally
- Database files directory structure

## First-Time Setup

When you launch the application for the first time, you'll be guided through a 3-step setup wizard:

### Step 1: Welcome
Introduction to the application and its features.

### Step 2: MySQL Connection
Configure your MySQL connection settings:

- **Host**: MySQL server hostname (default: `localhost`)
- **Port**: MySQL server port (default: `3306`)
- **Username**: MySQL username (default: `root`)
- **Password**: MySQL password (leave empty if none)
- **Socket Path** (macOS/Linux): Unix socket path (optional)
  - Common paths:
    - `/tmp/mysql.sock`
    - `/tmp/mysql_3306.sock` (DBngin)
    - `/var/run/mysqld/mysqld.sock` (Linux)

Click "Test Connection" to verify your settings before proceeding.

### Step 3: Database Directory
Select the directory where your SQL files are stored.

Expected structure:
```
/path/to/database/
├── full/           (Full SQL dumps)
├── slim/           (Reduced SQL dumps)
├── snapshots/      (Local database snapshots)
└── config/
    └── exclude-tables.txt
```

These folders will be created automatically if they don't exist.

## Usage

### Restore Database

1. Click "Restore Database" in the sidebar
2. Select file category (Full, Slim, or Snapshots)
3. Choose a database name
4. Select the SQL file to restore
5. Click "Start Restore"

The database will be dropped (if exists), recreated, and populated.

### Create Slim Dumps

1. Click "Create Slim Dumps"
2. Select SQL files from the full/ directory
3. Click "Create Slim Dumps"

Slim dumps exclude tables configured in `config/exclude-tables.txt`:
- `activity_log`, `sessions`
- `telescope_*` tables
- `cache*`, `job*` tables
- `failed_jobs`

### Create Snapshot

1. Click "Create Snapshot"
2. Select a local database
3. Enter description (e.g., "before-migration")
4. Choose type (Full or Slim)
5. Click "Create Snapshot"

Snapshots saved as: `{db}_snapshot_{description}_{timestamp}.sql`

### Delete Databases

1. Click "Delete Databases"
2. (Optional) Use pattern matching:
   - `explore_*` - matches all starting with "explore_"
   - `*_test` - matches all ending with "_test"
   - `temp_?_db` - matches "temp_1_db", "temp_2_db", etc.
3. Select databases to delete
4. Click "Delete Selected Databases"
5. Type "DELETE" to confirm

### Manage Files

1. Click "Manage Files"
2. Choose operation:
   - **Rename File**: Change filename
   - **Replace File**: Overwrite with another SQL file
   - **Delete Files**: Remove multiple SQL files

### Settings

Update MySQL connection or database directory.
Test connection to verify settings work.

## Project Structure

```
db-manager-gui/
├── electron/                 # Electron main process
│   ├── main.js              # Main process entry
│   ├── preload.cjs          # IPC bridge (security)
│   ├── ipc-handlers.js      # Database operation handlers
│   └── settings.js          # Settings management (electron-store)
├── src/                     # React frontend
│   ├── components/          # React components
│   │   ├── Sidebar.jsx      # Navigation
│   │   ├── StatusBar.jsx    # Connection status
│   │   ├── Restore.jsx      # Restore operation
│   │   ├── Slim.jsx         # Slim dump operation
│   │   ├── Snapshot.jsx     # Snapshot operation
│   │   ├── DeleteDatabases.jsx  # Bulk delete
│   │   ├── ManageFiles.jsx  # File management
│   │   ├── Settings.jsx     # Settings UI
│   │   └── FirstRun.jsx     # Setup wizard
│   ├── contexts/            # React contexts
│   │   └── OperationContext.jsx  # Operation state
│   ├── App.jsx              # Main app
│   ├── main.jsx             # React entry
│   └── index.css            # Tailwind styles
├── lib/                     # Shared library (copied from CLI)
│   ├── mysql.js             # MySQL operations
│   ├── files.js             # File operations
│   ├── utils.js             # Utilities
│   ├── restore.js           # Restore logic
│   ├── slim.js              # Slim dump logic
│   ├── snapshot.js          # Snapshot logic
│   ├── file-rename.js       # Rename logic
│   ├── file-replace.js      # Replace logic
│   └── file-delete.js       # Delete logic
├── build/                   # Build resources
│   ├── icon.icns            # macOS icon
│   ├── icon.ico             # Windows icon
│   └── icon.png             # Linux icon
├── public/                  # Public assets
│   └── icon.svg             # Source icon
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Development Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd db-manager-gui
npm install
```

### 2. Start Development Server

```bash
npm run electron:dev
```

This starts:
- Vite dev server on http://localhost:5173
- Electron app with hot reload

### 3. Build for Production

```bash
# Build React app
npm run build

# Build platform-specific installer
npm run electron:build -- --mac     # macOS DMG
npm run electron:build -- --win     # Windows installer
npm run electron:build -- --linux   # Linux AppImage

# Or build for all platforms
npm run electron:build
```

Output files in `dist/`:
- macOS: `Database Manager-1.0.0-arm64.dmg`
- Windows: `Database Manager Setup 1.0.0.exe`
- Linux: `Database Manager-1.0.0.AppImage`

## Troubleshooting

### Connection Issues

**"Cannot connect to MySQL server"**
- Verify MySQL is running
  - macOS: `mysql.server status`
  - Windows: Check Services
  - Linux: `sudo systemctl status mysql`
- Check credentials in Settings
- Try socket path instead of TCP/IP
- Test: `mysql -u root -p`

**"Access denied for user"**
- Verify username/password
- Check MySQL permissions:
  ```sql
  GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost';
  FLUSH PRIVILEGES;
  ```

### Installation Issues

**macOS: "App is damaged"**
- App is not code-signed
- Right-click → Open → Open in dialog
- Or: `xattr -cr /Applications/Database\ Manager.app`

**Windows: Antivirus blocks installer**
- App is not digitally signed
- Add exception to antivirus
- Download from trusted source

**Linux: Permission denied**
```bash
chmod +x Database\ Manager-1.0.0.AppImage
```

### Database Issues

**"Directory not found"**
- Use Settings to select valid directory
- Check read/write permissions
- Verify directory structure

**"No SQL files found"**
- Place files in correct subdirectory:
  - `full/` for full dumps
  - `slim/` for slim dumps
  - `snapshots/` for snapshots
- Check `.sql` file extension

**"Cannot drop database"**
- Close all connections
- Stop applications using the database
- Verify you have DROP privileges

## Configuration

### exclude-tables.txt

Located at `{database-directory}/config/exclude-tables.txt`

Lists tables to exclude from slim dumps (one per line):

```
activity_log
sessions
telescope_entries
telescope_entries_tags
telescope_monitoring
cache
cache_locks
jobs
job_batches
failed_jobs
```

## Architecture

**Main Process (Electron/Node.js)**
- Full file system and MySQL access
- Imports shared `lib/` modules
- Handles all database operations
- IPC communication with renderer

**Renderer Process (React)**
- UI only, no direct file/DB access
- Uses `window.dbManager.*` API
- Receives progress via IPC events
- Context isolated for security

**Security**
- Context isolation enabled
- IPC bridge in preload script
- Sandboxed renderer process
- No `nodeIntegration`

## Distribution

The macOS build is ready for distribution:
- File: `dist/Database Manager-1.0.0-arm64.dmg` (191 MB)
- Not code-signed (users will need to allow in Gatekeeper)
- Settings stored in user's Application Support directory
- First-run wizard guides setup

For Windows/Linux builds, run:
```bash
npm run electron:build -- --win
npm run electron:build -- --linux
```

## Changelog

### v1.0.0 (Initial Release)
- Database restore from SQL dumps
- Slim dump creation with table exclusion
- Snapshot management with descriptions
- Bulk database deletion with pattern matching
- File management (rename, replace, delete)
- Settings UI with MySQL configuration
- First-run setup wizard
- Progress tracking for all operations
- Dark theme optimized for developers

## License

MIT
# dbforge
