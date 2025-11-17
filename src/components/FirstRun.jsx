import { useState, useEffect } from 'react';

function FirstRun({ onComplete }) {
    const [step, setStep] = useState(1);
    const [mysqlConfig, setMysqlConfig] = useState({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '',
        socket: ''
    });
    const [databaseDirectory, setDatabaseDirectory] = useState('');
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState(null);
    const [completing, setCompleting] = useState(false);

    // Load default socket path on mount
    useEffect(() => {
        const loadDefaults = async () => {
            const config = await window.dbManager.getMySQLConfig();
            setMysqlConfig(config);

            const dir = await window.dbManager.getDatabaseDirectory();
            setDatabaseDirectory(dir);
        };
        loadDefaults();
    }, []);

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

    const handleComplete = async () => {
        try {
            setCompleting(true);

            // Save all settings
            await window.dbManager.saveMySQLConfig(mysqlConfig);
            await window.dbManager.saveDatabaseDirectory(databaseDirectory);
            await window.dbManager.setFirstRunComplete();

            // Notify parent component
            onComplete();
        } catch (error) {
            console.error('Failed to complete setup:', error);
            alert('Failed to save settings: ' + error.message);
        } finally {
            setCompleting(false);
        }
    };

    const canProceedToStep2 = connectionStatus?.success;
    const canProceedToStep3 = databaseDirectory.trim().length > 0;

    return (
        <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6">
            <div className="max-w-2xl w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-primary-400 mb-2">
                        Welcome to Database Manager
                    </h1>
                    <p className="text-dark-muted">
                        Let's get you set up in just a few steps
                    </p>
                </div>

                {/* Progress Indicator */}
                <div className="flex items-center justify-center mb-8">
                    {[1, 2, 3].map((stepNumber) => (
                        <div key={stepNumber} className="flex items-center">
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                                    step >= stepNumber
                                        ? 'bg-primary-500 text-white'
                                        : 'bg-dark-surface text-dark-muted border border-dark-border'
                                }`}
                            >
                                {stepNumber}
                            </div>
                            {stepNumber < 3 && (
                                <div
                                    className={`w-16 h-1 ${
                                        step > stepNumber ? 'bg-primary-500' : 'bg-dark-border'
                                    }`}
                                />
                            )}
                        </div>
                    ))}
                </div>

                {/* Content Card */}
                <div className="card">
                    {/* Step 1: Welcome */}
                    {step === 1 && (
                        <div>
                            <h2 className="text-2xl font-bold mb-4">
                                <span className="emoji-no-color">👋</span> Welcome!
                            </h2>
                            <div className="space-y-4 text-dark-muted">
                                <p>
                                    Database Manager helps you manage MySQL databases with features like:
                                </p>
                                <ul className="list-disc list-inside space-y-2 ml-4">
                                    <li>Restore databases from SQL dumps</li>
                                    <li>Create slim dumps by excluding large tables</li>
                                    <li>Create snapshots of local databases</li>
                                    <li>Manage and organize SQL files</li>
                                    <li>Bulk delete unused databases</li>
                                </ul>
                                <p className="mt-6">
                                    Before we begin, we need to configure your MySQL connection and
                                    database directory.
                                </p>
                            </div>

                            <div className="flex justify-end mt-6">
                                <button
                                    onClick={() => setStep(2)}
                                    className="btn-primary"
                                >
                                    Get Started
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: MySQL Configuration */}
                    {step === 2 && (
                        <div>
                            <h2 className="text-2xl font-bold mb-4">
                                <span className="emoji-no-color">🔌</span> MySQL Connection
                            </h2>
                            <p className="text-dark-muted mb-6">
                                Configure your MySQL connection settings. Default values work for most local setups.
                            </p>

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

                            <div className="flex justify-between mt-6">
                                <button
                                    onClick={() => setStep(1)}
                                    className="btn-secondary"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={() => setStep(3)}
                                    disabled={!canProceedToStep2}
                                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {canProceedToStep2 ? 'Continue' : 'Test connection first'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Database Directory */}
                    {step === 3 && (
                        <div>
                            <h2 className="text-2xl font-bold mb-4">
                                <span className="emoji-no-color">📂</span> Database Directory
                            </h2>
                            <p className="text-dark-muted mb-6">
                                Select the directory where your SQL files are stored. This should contain
                                your full/, slim/, and snapshots/ folders.
                            </p>

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

                                <div className="bg-blue-900/20 border border-blue-500/50 rounded p-4">
                                    <p className="text-sm text-blue-300">
                                        <strong>Note:</strong> If these folders don't exist yet, they will be
                                        created automatically when you use the corresponding features.
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-between mt-6">
                                <button
                                    onClick={() => setStep(2)}
                                    className="btn-secondary"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleComplete}
                                    disabled={!canProceedToStep3 || completing}
                                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {completing ? 'Completing...' : 'Complete Setup'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Help Text */}
                {step > 1 && (
                    <div className="text-center mt-4">
                        <p className="text-xs text-dark-muted">
                            You can always change these settings later in the Settings page
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default FirstRun;
