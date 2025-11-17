import { useState, useEffect } from 'react';
import { useOperation } from '../contexts/OperationContext';

function Settings() {
    const { startOperation, endOperation } = useOperation();
    const [mysqlConfig, setMysqlConfig] = useState({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '',
        socket: ''
    });
    const [databaseDirectory, setDatabaseDirectory] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState(null);
    const [saveStatus, setSaveStatus] = useState(null);

    // Load settings on mount
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const mysql = await window.dbManager.getMySQLConfig();
            const dbDir = await window.dbManager.getDatabaseDirectory();

            setMysqlConfig(mysql);
            setDatabaseDirectory(dbDir);
        } catch (error) {
            console.error('Failed to load settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleMysqlChange = (field, value) => {
        setMysqlConfig(prev => ({
            ...prev,
            [field]: field === 'port' ? Number(value) : value
        }));
    };

    const handleBrowseDirectory = async () => {
        const selectedDir = await window.dbManager.selectDirectory();
        if (selectedDir) {
            setDatabaseDirectory(selectedDir);
        }
    };

    const handleTestConnection = async () => {
        try {
            setTestingConnection(true);
            setConnectionStatus(null);

            // Temporarily save MySQL config for testing
            await window.dbManager.saveMySQLConfig(mysqlConfig);

            // Test connection
            const result = await window.dbManager.testConnection();

            if (result.success) {
                setConnectionStatus({ success: true, message: 'Connection successful!' });
            } else {
                setConnectionStatus({ success: false, message: result.error || 'Connection failed' });
            }
        } catch (error) {
            setConnectionStatus({ success: false, message: error.message });
        } finally {
            setTestingConnection(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setSaveStatus(null);
            startOperation('Saving settings');

            // Save MySQL config
            await window.dbManager.saveMySQLConfig(mysqlConfig);

            // Save database directory
            await window.dbManager.saveDatabaseDirectory(databaseDirectory);

            setSaveStatus({ success: true, message: 'Settings saved successfully!' });
            endOperation();

            // Reload settings to confirm
            setTimeout(() => {
                setSaveStatus(null);
            }, 3000);
        } catch (error) {
            setSaveStatus({ success: false, message: error.message });
            endOperation();
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-dark-muted">Loading settings...</p>
            </div>
        );
    }

    return (
        <div>
            <h2 className="text-2xl font-bold mb-2"><span className="emoji-no-color">⚙️</span> Settings</h2>
            <p className="text-dark-muted mb-6">
                Configure MySQL connection and database directory
            </p>

            <div className="space-y-6">
                {/* MySQL Connection Settings */}
                <div className="card">
                    <h3 className="font-bold text-lg mb-4">MySQL Connection</h3>

                    <div className="space-y-4">
                        {/* Host */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Host</label>
                            <input
                                type="text"
                                value={mysqlConfig.host}
                                onChange={(e) => handleMysqlChange('host', e.target.value)}
                                placeholder="localhost"
                                className="input w-full"
                            />
                            <p className="text-xs text-dark-muted mt-1">
                                MySQL server hostname or IP address
                            </p>
                        </div>

                        {/* Port */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Port</label>
                            <input
                                type="number"
                                value={mysqlConfig.port}
                                onChange={(e) => handleMysqlChange('port', e.target.value)}
                                placeholder="3306"
                                className="input w-full"
                            />
                            <p className="text-xs text-dark-muted mt-1">
                                MySQL server port (default: 3306)
                            </p>
                        </div>

                        {/* Username */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Username</label>
                            <input
                                type="text"
                                value={mysqlConfig.user}
                                onChange={(e) => handleMysqlChange('user', e.target.value)}
                                placeholder="root"
                                className="input w-full"
                            />
                            <p className="text-xs text-dark-muted mt-1">
                                MySQL username
                            </p>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Password</label>
                            <input
                                type="password"
                                value={mysqlConfig.password}
                                onChange={(e) => handleMysqlChange('password', e.target.value)}
                                placeholder="Leave empty if no password"
                                className="input w-full"
                            />
                            <p className="text-xs text-dark-muted mt-1">
                                MySQL password (optional)
                            </p>
                        </div>

                        {/* Socket (macOS/Linux) */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Socket Path (Optional)
                            </label>
                            <input
                                type="text"
                                value={mysqlConfig.socket}
                                onChange={(e) => handleMysqlChange('socket', e.target.value)}
                                placeholder="/tmp/mysql.sock"
                                className="input w-full"
                            />
                            <p className="text-xs text-dark-muted mt-1">
                                Unix socket path (macOS/Linux only, leave empty for TCP)
                            </p>
                        </div>

                        {/* Test Connection Button */}
                        <button
                            onClick={handleTestConnection}
                            disabled={testingConnection}
                            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {testingConnection ? 'Testing...' : 'Test Connection'}
                        </button>

                        {/* Connection Status */}
                        {connectionStatus && (
                            <div className={`p-3 rounded ${
                                connectionStatus.success
                                    ? 'bg-green-900/20 border border-green-500'
                                    : 'bg-red-900/20 border border-red-500'
                            }`}>
                                <p className={`text-sm ${
                                    connectionStatus.success ? 'text-green-400' : 'text-red-400'
                                }`}>
                                    {connectionStatus.success ? '✓' : '✗'} {connectionStatus.message}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Database Directory */}
                <div className="card">
                    <h3 className="font-bold text-lg mb-4">Database Directory</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                SQL Files Directory
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={databaseDirectory}
                                    onChange={(e) => setDatabaseDirectory(e.target.value)}
                                    placeholder="/path/to/database/files"
                                    className="input flex-1"
                                />
                                <button
                                    onClick={handleBrowseDirectory}
                                    className="btn-secondary"
                                >
                                    Browse...
                                </button>
                            </div>
                            <p className="text-xs text-dark-muted mt-1">
                                Directory containing full/, slim/, and snapshots/ folders
                            </p>
                        </div>

                        {/* Directory Structure Info */}
                        <div className="bg-dark-bg rounded p-4">
                            <p className="text-sm font-medium mb-2">Expected Structure:</p>
                            <pre className="text-xs text-dark-muted font-mono">
{`${databaseDirectory || '/path/to/database'}/
├── full/           (Full SQL dumps)
├── slim/           (Reduced SQL dumps)
├── snapshots/      (Local database snapshots)
└── config/
    └── exclude-tables.txt`}
                            </pre>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleSave}
                        disabled={saving || !databaseDirectory.trim()}
                        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>

                    {saveStatus && (
                        <div className={`text-sm ${
                            saveStatus.success ? 'text-green-400' : 'text-red-400'
                        }`}>
                            {saveStatus.success ? '✓' : '✗'} {saveStatus.message}
                        </div>
                    )}
                </div>

                {/* Help Text */}
                <div className="bg-blue-900/20 border border-blue-500/50 rounded p-4">
                    <p className="text-sm text-blue-300">
                        <strong>Note:</strong> After changing settings, you may need to restart the application
                        for all changes to take effect.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Settings;
