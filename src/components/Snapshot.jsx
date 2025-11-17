import { useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { useOperation } from '../contexts/OperationContext';
import SearchableDropdown from './SearchableDropdown';

function Snapshot() {
    const { startOperation, endOperation } = useOperation();
    const [step, setStep] = useState(1); // 1: Select DB, 2: Description & Type, 3: Confirm, 4: Progress
    const [selectedDb, setSelectedDb] = useState('');
    const [description, setDescription] = useState('');
    const [snapshotType, setSnapshotType] = useState('full'); // 'full' or 'slim'
    const [creating, setCreating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const { databases, loading: dbLoading } = useDatabase();

    const handleCreateSnapshot = async () => {
        try {
            setStep(4);
            setCreating(true);
            setError(null);
            setProgress(0);

            startOperation(`Creating snapshot: ${description}`);

            const snapshotResult = await window.dbManager.createSnapshot(
                selectedDb,
                description,
                snapshotType,
                (progressData) => {
                    setProgress(progressData.stepProgress || 0);
                    setCurrentStep(progressData.step || '');
                }
            );

            setResult(snapshotResult);
            setCreating(false);
            endOperation();
        } catch (err) {
            setError(err.message);
            setCreating(false);
            endOperation();
        }
    };

    const reset = () => {
        setStep(1);
        setSelectedDb('');
        setDescription('');
        setSnapshotType('full');
        setProgress(0);
        setCurrentStep('');
        setResult(null);
        setError(null);
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-2">📸 Create Snapshot</h2>
            <p className="text-dark-muted mb-6">
                Create a backup of your local database with a custom description
            </p>

            {/* Step 1: Select Database */}
            {step === 1 && (
                <div className="card">
                    <h3 className="font-bold mb-4">Select Database</h3>

                    {dbLoading ? (
                        <div className="text-center py-8 text-dark-muted">Loading databases...</div>
                    ) : databases.length === 0 ? (
                        <div className="text-center py-8 text-dark-muted">
                            No databases found
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <SearchableDropdown
                                options={databases}
                                value={selectedDb}
                                onChange={setSelectedDb}
                                placeholder="Select database to snapshot..."
                            />

                            {selectedDb && (
                                <div className="bg-blue-900/20 border border-blue-500/50 rounded p-4">
                                    <p className="text-sm text-blue-300">
                                        Selected: <span className="font-medium">{selectedDb}</span>
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={() => setStep(2)}
                                disabled={!selectedDb}
                                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Continue →
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Step 2: Description & Type */}
            {step === 2 && (
                <div className="card">
                    <div className="mb-4">
                        <span className="text-dark-muted">Database:</span>
                        <span className="ml-2 font-medium">{selectedDb}</span>
                    </div>

                    <h3 className="font-bold mb-4">Snapshot Details</h3>

                    <div className="space-y-4">
                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Description
                            </label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="e.g., before-migration, working-state, pre-refactor"
                                className="input w-full"
                            />
                            <p className="text-xs text-dark-muted mt-1">
                                This will be used in the filename: {selectedDb}_snapshot_{description}_timestamp.sql
                            </p>
                        </div>

                        {/* Snapshot Type */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Snapshot Type
                            </label>
                            <div className="space-y-2">
                                <label className="flex items-center gap-3 p-3 bg-dark-bg rounded cursor-pointer hover:bg-dark-border">
                                    <input
                                        type="radio"
                                        name="snapshotType"
                                        value="full"
                                        checked={snapshotType === 'full'}
                                        onChange={(e) => setSnapshotType(e.target.value)}
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium">Full Snapshot</div>
                                        <div className="text-sm text-dark-muted">
                                            Include all tables (larger file size)
                                        </div>
                                    </div>
                                </label>

                                <label className="flex items-center gap-3 p-3 bg-dark-bg rounded cursor-pointer hover:bg-dark-border">
                                    <input
                                        type="radio"
                                        name="snapshotType"
                                        value="slim"
                                        checked={snapshotType === 'slim'}
                                        onChange={(e) => setSnapshotType(e.target.value)}
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium">Slim Snapshot</div>
                                        <div className="text-sm text-dark-muted">
                                            Exclude large/transient tables (~70% smaller)
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-6">
                        <button onClick={() => setStep(1)} className="btn-secondary">
                            ← Back
                        </button>
                        <button
                            onClick={() => setStep(3)}
                            disabled={!description.trim()}
                            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Continue →
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Confirm */}
            {step === 3 && (
                <div className="card">
                    <h3 className="font-bold mb-4 text-xl">Confirm Snapshot</h3>

                    <div className="space-y-3 mb-6 bg-dark-bg p-4 rounded">
                        <div>
                            <span className="text-dark-muted">Database:</span>
                            <span className="ml-2 font-medium">{selectedDb}</span>
                        </div>
                        <div>
                            <span className="text-dark-muted">Description:</span>
                            <span className="ml-2 font-medium">{description}</span>
                        </div>
                        <div>
                            <span className="text-dark-muted">Type:</span>
                            <span className="ml-2 font-medium">
                                {snapshotType === 'full' ? 'Full Snapshot' : 'Slim Snapshot'}
                            </span>
                        </div>
                        <div>
                            <span className="text-dark-muted">Location:</span>
                            <span className="ml-2 font-medium text-xs">
                                snapshots/{selectedDb}_snapshot_{description}_[timestamp].sql
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => setStep(2)} className="btn-secondary">
                            ← Back
                        </button>
                        <button onClick={handleCreateSnapshot} className="btn-primary">
                            Create Snapshot
                        </button>
                    </div>
                </div>
            )}

            {/* Step 4: Progress/Result */}
            {step === 4 && (
                <div className="card">
                    {creating ? (
                        <div>
                            <h3 className="font-bold mb-4">Creating Snapshot...</h3>
                            <div className="space-y-3">
                                <div className="bg-dark-bg rounded p-4">
                                    {currentStep && (
                                        <div className="mb-3">
                                            <div className="text-sm text-primary-400">
                                                {currentStep}
                                                {progress > 0 && ` (${progress}%)`}
                                            </div>
                                        </div>
                                    )}
                                    <div className="bg-dark-border rounded-full h-3 overflow-hidden">
                                        <div
                                            className="bg-primary-600 h-full transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : error ? (
                        <div>
                            <h3 className="font-bold mb-4 text-red-400">❌ Snapshot Failed</h3>
                            <div className="bg-red-900/20 border border-red-500 rounded p-4 mb-4">
                                <p className="text-red-400 font-mono text-sm">{error}</p>
                            </div>
                            <button onClick={reset} className="btn-secondary">
                                ← Try Again
                            </button>
                        </div>
                    ) : result ? (
                        <div>
                            <h3 className="font-bold mb-4 text-green-400">✓ Snapshot Created</h3>
                            <div className="bg-green-900/20 border border-green-500 rounded p-4 mb-4 space-y-2">
                                <p className="font-medium">Snapshot created successfully!</p>
                                <div className="text-sm space-y-1">
                                    <div>
                                        <span className="text-dark-muted">File:</span>
                                        <span className="ml-2 font-mono text-xs">{result.filename}</span>
                                    </div>
                                    <div>
                                        <span className="text-dark-muted">Size:</span>
                                        <span className="ml-2">{result.size}</span>
                                    </div>
                                    <div>
                                        <span className="text-dark-muted">Tables:</span>
                                        <span className="ml-2">{result.tableCount}</span>
                                    </div>
                                    <div>
                                        <span className="text-dark-muted">Type:</span>
                                        <span className="ml-2">{result.type}</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={reset} className="btn-primary">
                                Create Another Snapshot
                            </button>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}

export default Snapshot;
