import { useState, useEffect } from 'react';
import { useDatabase, useFiles } from '../hooks/useDatabase';
import { useOperation } from '../contexts/OperationContext';
import SearchableDropdown from './SearchableDropdown';

function Restore() {
    const { startOperation, endOperation } = useOperation();
    const [step, setStep] = useState(1); // 1: Select file, 2: Select DB, 3: Confirm, 4: Progress
    const [selectedFile, setSelectedFile] = useState(null);
    const [selectedDir, setSelectedDir] = useState('full');
    const [dbName, setDbName] = useState('');
    const [restoreType, setRestoreType] = useState('new'); // 'new' or 'existing'
    const [progress, setProgress] = useState(0);
    const [bytesProcessed, setBytesProcessed] = useState(0);
    const [totalBytes, setTotalBytes] = useState(0);
    const [startTime, setStartTime] = useState(null);
    const [eta, setEta] = useState(null);
    const [restoring, setRestoring] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const { databases, loading: dbLoading, getDatabaseInfo } = useDatabase();
    const { files, loading: filesLoading } = useFiles(selectedDir);

    // Format ETA from milliseconds to human-readable string
    const formatEta = (ms) => {
        if (!ms || ms <= 0) return 'Calculating...';

        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            const remainingMinutes = minutes % 60;
            return `${hours}h ${remainingMinutes}m`;
        } else if (minutes > 0) {
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds}s`;
        } else {
            return `${seconds}s`;
        }
    };

    const handleFileSelect = (file) => {
        setSelectedFile(file);
        setStep(2);
    };

    const handleRestore = async () => {
        try {
            setStep(4);
            setRestoring(true);
            setError(null);
            setProgress(0);
            setBytesProcessed(0);
            setEta(null);
            const start = Date.now();
            setStartTime(start);

            // Mark operation as active
            startOperation(`Restoring database: ${dbName}`);

            // Get file info to know total size
            const fileInfo = await window.dbManager.getFileInfo(selectedFile.path);
            setTotalBytes(fileInfo.sizeBytes);

            const result = await window.dbManager.restoreDatabase(
                dbName,
                selectedFile.path,
                (progressData) => {
                    const bytes = progressData.bytesProcessed;
                    setBytesProcessed(bytes);
                    const percentage = fileInfo.sizeBytes > 0 ? Math.round((bytes / fileInfo.sizeBytes) * 100) : 0;
                    setProgress(percentage);

                    // Calculate ETA
                    if (bytes > 0 && fileInfo.sizeBytes > 0) {
                        const elapsed = Date.now() - start;
                        const bytesPerMs = bytes / elapsed;
                        const remainingBytes = fileInfo.sizeBytes - bytes;
                        const remainingMs = remainingBytes / bytesPerMs;
                        setEta(remainingMs);
                    }
                }
            );

            setResult(result);
            setRestoring(false);
            endOperation();
        } catch (err) {
            setError(err.message);
            setRestoring(false);
            endOperation();
        }
    };

    const reset = () => {
        setStep(1);
        setSelectedFile(null);
        setDbName('');
        setRestoreType('new');
        setProgress(0);
        setBytesProcessed(0);
        setTotalBytes(0);
        setStartTime(null);
        setEta(null);
        setResult(null);
        setError(null);
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-2">📥 Restore Database</h2>
            <p className="text-dark-muted mb-6">
                Restore a database from SQL dump files
            </p>

            {/* Step 1: Select SQL File */}
            {step === 1 && (
                <div className="space-y-4">
                    {/* Directory selector */}
                    <div className="card">
                        <h3 className="font-bold mb-3">Select Directory</h3>
                        <div className="flex gap-2">
                            {['full', 'slim', 'snapshots'].map((dir) => (
                                <button
                                    key={dir}
                                    onClick={() => setSelectedDir(dir)}
                                    className={`px-4 py-2 rounded ${
                                        selectedDir === dir
                                            ? 'bg-primary-600 text-white'
                                            : 'bg-dark-bg hover:bg-dark-border'
                                    }`}
                                >
                                    {dir}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* File list */}
                    <div className="card">
                        <h3 className="font-bold mb-3">Select SQL File</h3>
                        {filesLoading ? (
                            <div className="text-center py-8 text-dark-muted">Loading files...</div>
                        ) : files.length === 0 ? (
                            <div className="text-center py-8 text-dark-muted">
                                No SQL files found in {selectedDir}/
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {files.map((file) => (
                                    <div
                                        key={file.path}
                                        onClick={() => handleFileSelect(file)}
                                        className="p-3 bg-dark-bg hover:bg-dark-border rounded cursor-pointer transition-colors"
                                    >
                                        <div className="font-medium">{file.name}</div>
                                        <div className="text-sm text-dark-muted">
                                            {file.path}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Step 2: Select Database */}
            {step === 2 && (
                <div className="space-y-4">
                    <div className="card">
                        <div className="mb-4">
                            <span className="text-dark-muted">Selected file:</span>
                            <span className="ml-2 font-medium">{selectedFile?.name}</span>
                        </div>

                        <h3 className="font-bold mb-3">Database Name</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="flex items-center gap-2 mb-2">
                                    <input
                                        type="radio"
                                        checked={restoreType === 'new'}
                                        onChange={() => setRestoreType('new')}
                                    />
                                    <span>New database</span>
                                </label>
                                {restoreType === 'new' && (
                                    <input
                                        type="text"
                                        value={dbName}
                                        onChange={(e) => setDbName(e.target.value)}
                                        placeholder="Enter database name"
                                        className="input w-full"
                                    />
                                )}
                            </div>

                            <div>
                                <label className="flex items-center gap-2 mb-2">
                                    <input
                                        type="radio"
                                        checked={restoreType === 'existing'}
                                        onChange={() => setRestoreType('existing')}
                                    />
                                    <span>Existing database (will be overwritten)</span>
                                </label>
                                {restoreType === 'existing' && (
                                    <SearchableDropdown
                                        options={databases}
                                        value={dbName}
                                        onChange={setDbName}
                                        placeholder="Select database..."
                                    />
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button onClick={() => setStep(1)} className="btn-secondary">
                                ← Back
                            </button>
                            <button
                                onClick={() => setStep(3)}
                                disabled={!dbName}
                                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Continue →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Confirm */}
            {step === 3 && (
                <div className="card">
                    <h3 className="font-bold mb-4 text-xl">Confirm Restore</h3>
                    <div className="space-y-3 mb-6 bg-dark-bg p-4 rounded">
                        <div>
                            <span className="text-dark-muted">File:</span>
                            <span className="ml-2 font-medium">{selectedFile?.name}</span>
                        </div>
                        <div>
                            <span className="text-dark-muted">Database:</span>
                            <span className="ml-2 font-medium">{dbName}</span>
                        </div>
                        <div>
                            <span className="text-dark-muted">Action:</span>
                            <span className="ml-2 font-medium">
                                {restoreType === 'new' ? 'Create new database' : 'Overwrite existing database'}
                            </span>
                        </div>
                    </div>

                    {restoreType === 'existing' && (
                        <div className="bg-red-900/20 border border-red-500 rounded p-4 mb-6">
                            <p className="text-red-400 font-medium">⚠️ Warning</p>
                            <p className="text-sm mt-1">
                                This will permanently delete all data in '{dbName}' and replace it with the dump file.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button onClick={() => setStep(2)} className="btn-secondary">
                            ← Back
                        </button>
                        <button onClick={handleRestore} className="btn-primary">
                            Start Restore
                        </button>
                    </div>
                </div>
            )}

            {/* Step 4: Progress/Result */}
            {step === 4 && (
                <div className="card">
                    {restoring ? (
                        <div>
                            <h3 className="font-bold mb-4">Restoring Database...</h3>
                            <div className="space-y-3">
                                <div className="bg-dark-bg rounded-full h-4 overflow-hidden">
                                    <div
                                        className="bg-primary-600 h-full transition-all duration-300"
                                        style={{ width: `${Math.min(100, progress)}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-dark-muted">
                                        {progress}% complete ({(bytesProcessed / (1024 * 1024)).toFixed(1)} MB / {(totalBytes / (1024 * 1024)).toFixed(1)} MB)
                                    </span>
                                    <span className="text-primary-400 font-medium">
                                        ETA: {formatEta(eta)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : error ? (
                        <div>
                            <h3 className="font-bold mb-4 text-red-400">❌ Restore Failed</h3>
                            <div className="bg-red-900/20 border border-red-500 rounded p-4 mb-4">
                                <p className="text-red-400 font-mono text-sm">{error}</p>
                            </div>
                            <button onClick={reset} className="btn-secondary">
                                ← Try Again
                            </button>
                        </div>
                    ) : result ? (
                        <div>
                            <h3 className="font-bold mb-4 text-green-400">✓ Restore Complete</h3>
                            <div className="bg-green-900/20 border border-green-500 rounded p-4 mb-4 space-y-2">
                                <p>Database '{dbName}' restored successfully!</p>
                                <div className="text-sm text-dark-muted">
                                    <div>Tables: {result.tableCount}</div>
                                    <div>Size: {result.sizeMB} MB</div>
                                </div>
                            </div>
                            <button onClick={reset} className="btn-primary">
                                Restore Another Database
                            </button>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}

export default Restore;
