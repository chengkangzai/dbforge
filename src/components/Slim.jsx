import { useState } from 'react';
import { useFiles } from '../hooks/useDatabase';
import { useOperation } from '../contexts/OperationContext';

function Slim() {
    const { startOperation, endOperation } = useOperation();
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [currentFile, setCurrentFile] = useState(null);
    const [currentStep, setCurrentStep] = useState('');
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [stepProgress, setStepProgress] = useState(0); // Progress within current step (0-100)
    const [results, setResults] = useState([]);
    const [error, setError] = useState(null);
    const [restoreAfterCreate, setRestoreAfterCreate] = useState(false);
    const [databaseNames, setDatabaseNames] = useState({});

    const { files, loading: filesLoading } = useFiles('full');

    // Generate default database name from filename
    const getDefaultDbName = (filename) => {
        // Remove .sql extension
        let name = filename.replace(/\.sql$/i, '');
        // Remove _slim suffix if it exists
        name = name.replace(/_slim$/i, '');
        // Replace _prod or _sd with _dev
        name = name.replace(/_(prod|sd)$/i, '_dev');
        return name;
    };

    const handleFileToggle = (file) => {
        setSelectedFiles(prev => {
            const isSelected = prev.some(f => f.path === file.path);
            if (isSelected) {
                // Remove from selection and database names
                setDatabaseNames(prevNames => {
                    const newNames = { ...prevNames };
                    delete newNames[file.path];
                    return newNames;
                });
                return prev.filter(f => f.path !== file.path);
            } else {
                // Add to selection and set default database name
                setDatabaseNames(prevNames => ({
                    ...prevNames,
                    [file.path]: getDefaultDbName(file.name)
                }));
                return [...prev, file];
            }
        });
    };

    const handleDatabaseNameChange = (filePath, newName) => {
        setDatabaseNames(prev => ({
            ...prev,
            [filePath]: newName
        }));
    };

    const handleSelectAll = () => {
        if (selectedFiles.length === files.length) {
            setSelectedFiles([]);
            setDatabaseNames({});
        } else {
            setSelectedFiles([...files]);
            // Set default database names for all files
            const names = {};
            files.forEach(file => {
                names[file.path] = getDefaultDbName(file.name);
            });
            setDatabaseNames(names);
        }
    };

    const handleProcess = async () => {
        if (selectedFiles.length === 0) return;

        // Validate database names if restore is enabled
        if (restoreAfterCreate) {
            const emptyNames = selectedFiles.filter(f => !databaseNames[f.path] || !databaseNames[f.path].trim());
            if (emptyNames.length > 0) {
                setError('Please provide database names for all selected files');
                return;
            }
        }

        try {
            setProcessing(true);
            setError(null);
            setResults([]);
            setProgress({ current: 0, total: selectedFiles.length });

            startOperation(`Creating slim dumps (0/${selectedFiles.length})`);

            const filePaths = selectedFiles.map(f => f.path);

            // Build restore configuration if enabled
            const restoreConfig = restoreAfterCreate ? {
                enabled: true,
                databaseNames: databaseNames
            } : null;

            const result = await window.dbManager.createSlimDumps(
                filePaths,
                (progressData) => {
                    setProgress({
                        current: progressData.current,
                        total: progressData.total
                    });
                    setCurrentFile(progressData.currentFile);
                    setCurrentStep(progressData.step);
                    setStepProgress(progressData.stepProgress || 0);

                    // Update operation message
                    const operation = restoreAfterCreate ? 'Creating & restoring' : 'Creating slim dumps';
                    startOperation(`${operation} (${progressData.current}/${progressData.total})`);
                },
                restoreConfig
            );

            setResults(result.results);
            setProcessing(false);
            endOperation();
        } catch (err) {
            setError(err.message);
            setProcessing(false);
            endOperation();
        }
    };

    const reset = () => {
        setSelectedFiles([]);
        setCurrentFile(null);
        setCurrentStep('');
        setProgress({ current: 0, total: 0 });
        setStepProgress(0);
        setResults([]);
        setError(null);
        setRestoreAfterCreate(false);
        setDatabaseNames({});
    };

    const allSelected = files.length > 0 && selectedFiles.length === files.length;

    return (
        <div>
            <h2 className="text-2xl font-bold mb-2"><span className="emoji-no-color">✂️</span> Create Slim Dumps</h2>
            <p className="text-dark-muted mb-6">
                Generate reduced dumps by excluding large tables (~70% reduction)
            </p>

            {/* File Selection */}
            {!processing && results.length === 0 && (
                <div className="space-y-4">
                    <div className="card">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold">Select Full Dumps to Process</h3>
                            <button
                                onClick={handleSelectAll}
                                className="text-sm text-primary-400 hover:text-primary-300"
                            >
                                {allSelected ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>

                        {filesLoading ? (
                            <div className="text-center py-8 text-dark-muted">Loading files...</div>
                        ) : files.length === 0 ? (
                            <div className="text-center py-8 text-dark-muted">
                                No SQL files found in full/ directory
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {files.map((file) => {
                                    const isSelected = selectedFiles.some(f => f.path === file.path);
                                    const sizeInMB = (file.size || 0) / (1024 * 1024);
                                    const sizeDisplay = sizeInMB >= 1024
                                        ? `${(sizeInMB / 1024).toFixed(2)} GB`
                                        : `${sizeInMB.toFixed(1)} MB`;

                                    return (
                                        <label
                                            key={file.path}
                                            className={`flex items-center gap-3 p-3 rounded cursor-pointer transition-colors ${
                                                isSelected
                                                    ? 'bg-primary-600/20 border border-primary-600'
                                                    : 'bg-dark-bg hover:bg-dark-border'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleFileToggle(file)}
                                                className="w-4 h-4"
                                            />
                                            <div className="flex-1">
                                                <div className="font-medium">{file.name}</div>
                                                <div className="text-sm text-dark-muted">
                                                    {sizeDisplay}
                                                </div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        )}

                        {/* Restore After Create Option */}
                        {selectedFiles.length > 0 && (
                            <div className="mt-6 border-t border-dark-border pt-6">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={restoreAfterCreate}
                                        onChange={(e) => setRestoreAfterCreate(e.target.checked)}
                                        className="w-4 h-4"
                                    />
                                    <div>
                                        <div className="font-medium text-primary-400">
                                            Restore slim dumps after creation
                                        </div>
                                        <div className="text-sm text-dark-muted">
                                            Automatically import slim dumps into specified databases
                                        </div>
                                    </div>
                                </label>

                                {/* Database Name Inputs */}
                                {restoreAfterCreate && (
                                    <div className="mt-4 space-y-3 p-4 bg-dark-bg rounded">
                                        <h4 className="font-medium text-sm text-primary-300 mb-3">
                                            Database Names for Restore
                                        </h4>
                                        {selectedFiles.map((file) => (
                                            <div key={file.path} className="flex items-center gap-3">
                                                <div className="flex-1">
                                                    <div className="text-sm text-dark-muted mb-1">
                                                        {file.name}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={databaseNames[file.path] || ''}
                                                        onChange={(e) => handleDatabaseNameChange(file.path, e.target.value)}
                                                        placeholder="Enter database name..."
                                                        className="input w-full"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                        <div className="text-xs text-yellow-400/70 mt-3">
                                            ⚠️ Warning: Existing databases will be dropped and recreated
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-6 flex gap-2">
                            <button
                                onClick={handleProcess}
                                disabled={selectedFiles.length === 0}
                                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {restoreAfterCreate
                                    ? `Create & Restore (${selectedFiles.length} ${selectedFiles.length === 1 ? 'file' : 'files'})`
                                    : `Create Slim Dumps (${selectedFiles.length} ${selectedFiles.length === 1 ? 'file' : 'files'})`
                                }
                            </button>
                        </div>
                    </div>

                    {selectedFiles.length > 0 && (
                        <div className="card bg-blue-900/20 border-blue-500/50">
                            <h4 className="font-medium text-blue-400 mb-2">Selected Files:</h4>
                            <ul className="text-sm space-y-1">
                                {selectedFiles.map((file) => (
                                    <li key={file.path} className="text-blue-300">• {file.name}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Processing Progress */}
            {processing && (
                <div className="card">
                    <h3 className="font-bold mb-4">Creating Slim Dumps...</h3>
                    <div className="space-y-4">
                        <div className="bg-dark-bg rounded p-4">
                            <div className="text-sm text-dark-muted mb-2">
                                Processing file {progress.current + 1} of {progress.total}
                            </div>
                            {currentFile && (
                                <div className="mb-3">
                                    <div className="font-medium">{currentFile}</div>
                                    <div className="text-sm text-primary-400">
                                        {currentStep}
                                        {stepProgress > 0 && ` (${stepProgress}%)`}
                                    </div>
                                </div>
                            )}

                            {/* Step progress bar */}
                            <div className="mb-2">
                                <div className="bg-dark-border rounded-full h-3 overflow-hidden">
                                    <div
                                        className="bg-primary-600 h-full transition-all duration-300"
                                        style={{ width: `${stepProgress}%` }}
                                    />
                                </div>
                            </div>

                            {/* Overall progress */}
                            {progress.total > 1 && (
                                <div className="text-xs text-dark-muted">
                                    Overall: {progress.current} of {progress.total} files completed
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Results */}
            {!processing && results.length > 0 && (
                <div className="card">
                    <h3 className="font-bold mb-4 text-green-400">✓ Slim Dumps Created</h3>

                    <div className="space-y-3 mb-6">
                        {results.map((result, index) => (
                            <div key={index} className="bg-dark-bg rounded p-4">
                                <div className="font-medium mb-2">{result.fileName}</div>
                                {result.success ? (
                                    <>
                                        <div className="text-sm space-y-1">
                                            <div className="text-dark-muted">
                                                Full: {result.fullSize} → Slim: {result.slimSize}
                                            </div>
                                            <div className="text-green-400">
                                                {result.savings}% smaller
                                            </div>
                                            <div className="text-dark-muted text-xs">
                                                {result.slimPath}
                                            </div>
                                            {result.restored && (
                                                <div className="mt-3 pt-3 border-t border-dark-border">
                                                    <div className="text-primary-400 font-medium mb-1">
                                                        ✓ Restored to database
                                                    </div>
                                                    <div className="text-dark-muted">
                                                        Database: <span className="text-white">{result.restored.databaseName}</span>
                                                    </div>
                                                    <div className="text-dark-muted">
                                                        Tables: {result.restored.tableCount} • Size: {result.restored.size.toFixed(2)} MB
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-sm text-red-400">
                                        Failed: {result.error}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <button onClick={reset} className="btn-primary">
                        Create More Slim Dumps
                    </button>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="card">
                    <h3 className="font-bold mb-4 text-red-400">❌ Operation Failed</h3>
                    <div className="bg-red-900/20 border border-red-500 rounded p-4 mb-4">
                        <p className="text-red-400 font-mono text-sm">{error}</p>
                    </div>
                    <button onClick={reset} className="btn-secondary">
                        ← Try Again
                    </button>
                </div>
            )}
        </div>
    );
}

export default Slim;
