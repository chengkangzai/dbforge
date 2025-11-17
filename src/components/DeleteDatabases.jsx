import { useState, useMemo, useEffect } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { useOperation } from '../contexts/OperationContext';

function DeleteDatabases() {
    const { startOperation, endOperation } = useOperation();
    const [step, setStep] = useState(1); // 1: Select, 2: Confirm, 3: Result
    const [selectedDatabases, setSelectedDatabases] = useState([]);
    const [patternFilter, setPatternFilter] = useState('');
    const [databaseInfo, setDatabaseInfo] = useState({});
    const [deleting, setDeleting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, currentDb: '' });
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const { databases, loading: dbLoading, reload: reloadDatabases } = useDatabase();

    // Fetch database info for all databases
    const loadDatabaseInfo = async () => {
        const info = {};
        for (const db of databases) {
            try {
                const dbInfo = await window.dbManager.getDatabaseInfo(db);
                info[db] = dbInfo;
            } catch (err) {
                info[db] = { tableCount: 0, sizeMB: 0 };
            }
        }
        setDatabaseInfo(info);
    };

    // Load database info on mount
    useEffect(() => {
        if (databases.length > 0 && Object.keys(databaseInfo).length === 0) {
            loadDatabaseInfo();
        }
    }, [databases]);

    // Convert wildcard pattern to regex
    const wildcardToRegex = (pattern) => {
        if (!pattern) return null;
        const escaped = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars
            .replace(/\*/g, '.*')                    // * = any characters
            .replace(/\?/g, '.');                    // ? = single character
        return new RegExp('^' + escaped + '$', 'i');
    };

    // Filter databases by pattern
    const filteredDatabases = useMemo(() => {
        if (!patternFilter.trim()) return databases;
        const regex = wildcardToRegex(patternFilter);
        return databases.filter(db => regex.test(db));
    }, [databases, patternFilter]);

    // Calculate total size and tables for selected databases
    const calculateTotals = (dbList) => {
        let totalTables = 0;
        let totalBytes = 0;

        dbList.forEach(db => {
            const info = databaseInfo[db];
            if (info) {
                totalTables += Number(info.tableCount) || 0;
                totalBytes += (Number(info.sizeMB) || 0) * 1024 * 1024;
            }
        });

        const sizeInMB = totalBytes / (1024 * 1024);
        const size = sizeInMB >= 1024
            ? `${(sizeInMB / 1024).toFixed(2)} GB`
            : `${sizeInMB.toFixed(1)} MB`;

        return { totalTables, size };
    };

    const toggleDatabaseSelection = (db) => {
        setSelectedDatabases(prev => {
            const isSelected = prev.includes(db);
            if (isSelected) {
                return prev.filter(d => d !== db);
            } else {
                return [...prev, db];
            }
        });
    };

    const selectAll = () => {
        setSelectedDatabases([...databases]);
    };

    const selectByPattern = () => {
        setSelectedDatabases([...filteredDatabases]);
    };

    const clearSelection = () => {
        setSelectedDatabases([]);
    };

    const handleDelete = async () => {
        try {
            setStep(3);
            setDeleting(true);
            setError(null);

            startOperation(`Deleting ${selectedDatabases.length} databases`);

            const deleteResult = await window.dbManager.bulkDeleteDatabases(
                selectedDatabases,
                (progressData) => {
                    setProgress(progressData);
                }
            );

            setResult(deleteResult);
            setDeleting(false);
            endOperation();
        } catch (err) {
            setError(err.message);
            setDeleting(false);
            endOperation();
        }
    };

    const reset = async () => {
        setStep(1);
        setSelectedDatabases([]);
        setPatternFilter('');
        setProgress({ current: 0, total: 0, currentDb: '' });
        setResult(null);
        setError(null);
        // Reload databases and their info after deletion
        await reloadDatabases();
        await loadDatabaseInfo();
    };

    const totals = calculateTotals(selectedDatabases);

    return (
        <div>
            <h2 className="text-2xl font-bold mb-2">🗄️ Delete Databases</h2>
            <p className="text-dark-muted mb-6">
                Remove unused databases from your local MySQL server
            </p>

            {/* Step 1: Select Databases */}
            {step === 1 && (
                <div className="card">
                    <h3 className="font-bold mb-4">Select Databases to Delete</h3>

                    {/* Pattern Filter */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">
                            Pattern Filter (optional)
                        </label>
                        <input
                            type="text"
                            value={patternFilter}
                            onChange={(e) => setPatternFilter(e.target.value)}
                            placeholder="e.g., explore_*, *_temp, test_?"
                            className="input w-full"
                        />
                        <p className="text-xs text-dark-muted mt-1">
                            Use * for any characters, ? for single character
                        </p>
                    </div>

                    {/* Bulk Selection Buttons */}
                    <div className="grid grid-cols-3 gap-2 mb-6">
                        <button
                            onClick={selectAll}
                            className="p-3 bg-dark-bg hover:bg-dark-border rounded text-sm"
                        >
                            Select All
                            <div className="text-xs text-dark-muted mt-1">
                                {databases.length} databases
                            </div>
                        </button>
                        <button
                            onClick={selectByPattern}
                            disabled={!patternFilter.trim()}
                            className="p-3 bg-dark-bg hover:bg-dark-border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Select by Pattern
                            <div className="text-xs text-dark-muted mt-1">
                                {filteredDatabases.length} matches
                            </div>
                        </button>
                        <button
                            onClick={clearSelection}
                            className="p-3 bg-dark-bg hover:bg-dark-border rounded text-sm"
                        >
                            Clear Selection
                            <div className="text-xs text-dark-muted mt-1">
                                {selectedDatabases.length} selected
                            </div>
                        </button>
                    </div>

                    {/* Database List */}
                    {dbLoading ? (
                        <div className="text-center py-8 text-dark-muted">Loading databases...</div>
                    ) : databases.length === 0 ? (
                        <div className="text-center py-8 text-dark-muted">
                            No databases found
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto mb-6">
                            {filteredDatabases.map(db => {
                                const info = databaseInfo[db] || { tableCount: 0, sizeMB: 0 };
                                const sizeInMB = Number(info.sizeMB) || 0;
                                const sizeDisplay = sizeInMB >= 1024
                                    ? `${(sizeInMB / 1024).toFixed(2)} GB`
                                    : `${sizeInMB.toFixed(1)} MB`;

                                return (
                                    <label
                                        key={db}
                                        className="flex items-center gap-3 p-3 bg-dark-bg hover:bg-dark-border rounded cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedDatabases.includes(db)}
                                            onChange={() => toggleDatabaseSelection(db)}
                                            className="w-4 h-4"
                                        />
                                        <div className="flex-1">
                                            <div className="font-medium">{db}</div>
                                            <div className="text-xs text-dark-muted">
                                                {info.tableCount || 0} tables • {sizeDisplay}
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    )}

                    {/* Selection Summary */}
                    {selectedDatabases.length > 0 && (
                        <div className="bg-blue-900/20 border border-blue-500/50 rounded p-4 mb-4">
                            <p className="text-sm text-blue-300">
                                <span className="font-medium">{selectedDatabases.length}</span> databases selected
                                {' • '}
                                {totals.totalTables} tables
                                {' • '}
                                {totals.size}
                            </p>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            onClick={() => setStep(2)}
                            disabled={selectedDatabases.length === 0}
                            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Continue → ({selectedDatabases.length} selected)
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Confirm Deletion */}
            {step === 2 && (
                <div className="card">
                    <h3 className="font-bold mb-4 text-xl">Confirm Deletion</h3>

                    <div className="bg-red-900/20 border border-red-500 rounded p-4 mb-6">
                        <p className="text-red-400 font-medium mb-2">⚠️ Warning: This action cannot be undone!</p>
                        <p className="text-sm text-red-300">
                            You are about to permanently delete the following databases and all their data.
                        </p>
                    </div>

                    <div className="bg-dark-bg rounded p-4 mb-6">
                        <h4 className="font-medium mb-3">Databases to delete:</h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {selectedDatabases.map(db => {
                                const info = databaseInfo[db] || { tableCount: 0, sizeMB: 0 };
                                const sizeInMB = Number(info.sizeMB) || 0;
                                const sizeDisplay = sizeInMB >= 1024
                                    ? `${(sizeInMB / 1024).toFixed(2)} GB`
                                    : `${sizeInMB.toFixed(1)} MB`;

                                return (
                                    <div key={db} className="flex justify-between text-sm">
                                        <span className="font-medium text-red-400">{db}</span>
                                        <span className="text-dark-muted">
                                            {info.tableCount || 0} tables • {sizeDisplay}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-dark-bg rounded p-4 mb-6">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-dark-muted">Total databases:</span>
                                <span className="ml-2 font-medium">{selectedDatabases.length}</span>
                            </div>
                            <div>
                                <span className="text-dark-muted">Total tables:</span>
                                <span className="ml-2 font-medium">{totals.totalTables}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-dark-muted">Total space to free:</span>
                                <span className="ml-2 font-medium">{totals.size}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => setStep(1)} className="btn-secondary">
                            ← Back
                        </button>
                        <button onClick={handleDelete} className="btn-danger">
                            Delete {selectedDatabases.length} Databases
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Progress/Result */}
            {step === 3 && (
                <div className="card">
                    {deleting ? (
                        <div>
                            <h3 className="font-bold mb-4">Deleting Databases...</h3>
                            <div className="space-y-3">
                                <div className="bg-dark-bg rounded p-4">
                                    {progress.currentDb && (
                                        <div className="mb-3">
                                            <div className="text-sm text-primary-400">
                                                Deleting: {progress.currentDb}
                                            </div>
                                            <div className="text-xs text-dark-muted mt-1">
                                                {progress.current} of {progress.total}
                                            </div>
                                        </div>
                                    )}
                                    <div className="bg-dark-border rounded-full h-3 overflow-hidden">
                                        <div
                                            className="bg-primary-600 h-full transition-all duration-300"
                                            style={{
                                                width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : error ? (
                        <div>
                            <h3 className="font-bold mb-4 text-red-400">❌ Deletion Failed</h3>
                            <div className="bg-red-900/20 border border-red-500 rounded p-4 mb-4">
                                <p className="text-red-400 font-mono text-sm">{error}</p>
                            </div>
                            <button onClick={reset} className="btn-secondary">
                                ← Try Again
                            </button>
                        </div>
                    ) : result ? (
                        <div>
                            <h3 className="font-bold mb-4 text-green-400">✓ Deletion Complete</h3>
                            <div className="bg-green-900/20 border border-green-500 rounded p-4 mb-4">
                                <p className="font-medium mb-2">
                                    Successfully deleted {result.deleted.length} databases
                                </p>
                                {result.errors.length > 0 && (
                                    <div className="mt-3 p-3 bg-red-900/20 border border-red-500/50 rounded">
                                        <p className="text-sm text-red-400 font-medium mb-1">
                                            Failed to delete {result.errors.length} databases:
                                        </p>
                                        {result.errors.map((err, idx) => (
                                            <p key={idx} className="text-xs text-red-300 font-mono">
                                                {err.database}: {err.error}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button onClick={reset} className="btn-primary">
                                Delete More Databases
                            </button>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}

export default DeleteDatabases;
