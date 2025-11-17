import { useState } from 'react';
import { useOperation } from '../contexts/OperationContext';
import { useFiles } from '../hooks/useDatabase';

function ManageFiles() {
    const { startOperation, endOperation } = useOperation();
    const [operation, setOperation] = useState(null); // null | 'rename' | 'replace' | 'delete'

    const selectOperation = (op) => {
        setOperation(op);
    };

    const resetToSelection = () => {
        setOperation(null);
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-2"><span className="emoji-no-color">📁</span> Manage Files</h2>
            <p className="text-dark-muted mb-6">
                Rename, replace, or delete SQL dump files
            </p>

            {/* Operation Selection */}
            {!operation && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Rename Card */}
                    <button
                        onClick={() => selectOperation('rename')}
                        className="card hover:bg-dark-border transition-colors text-left p-6 cursor-pointer"
                    >
                        <div className="text-4xl mb-3"><span className="emoji-no-color">📝</span></div>
                        <h3 className="font-bold text-lg mb-2">Rename File</h3>
                        <p className="text-sm text-dark-muted">
                            Change the filename of an existing SQL dump
                        </p>
                    </button>

                    {/* Replace Card */}
                    <button
                        onClick={() => selectOperation('replace')}
                        className="card hover:bg-dark-border transition-colors text-left p-6 cursor-pointer"
                    >
                        <div className="text-4xl mb-3"><span className="emoji-no-color">🔄</span></div>
                        <h3 className="font-bold text-lg mb-2">Replace File</h3>
                        <p className="text-sm text-dark-muted">
                            Update an existing dump with a new version
                        </p>
                    </button>

                    {/* Delete Card */}
                    <button
                        onClick={() => selectOperation('delete')}
                        className="card hover:bg-dark-border transition-colors text-left p-6 cursor-pointer"
                    >
                        <div className="text-4xl mb-3"><span className="emoji-no-color">🗑️</span></div>
                        <h3 className="font-bold text-lg mb-2">Delete Files</h3>
                        <p className="text-sm text-dark-muted">
                            Remove old dumps and free up disk space
                        </p>
                    </button>
                </div>
            )}

            {/* Rename Flow */}
            {operation === 'rename' && (
                <RenameFlow
                    onBack={resetToSelection}
                    startOperation={startOperation}
                    endOperation={endOperation}
                />
            )}

            {/* Replace Flow */}
            {operation === 'replace' && (
                <ReplaceFlow
                    onBack={resetToSelection}
                    startOperation={startOperation}
                    endOperation={endOperation}
                />
            )}

            {/* Delete Flow */}
            {operation === 'delete' && (
                <DeleteFlow
                    onBack={resetToSelection}
                    startOperation={startOperation}
                    endOperation={endOperation}
                />
            )}
        </div>
    );
}

// Rename Flow Component
function RenameFlow({ onBack, startOperation, endOperation }) {
    const [step, setStep] = useState(1); // 1: Select File, 2: New Name, 3: Confirm, 4: Result
    const [selectedFile, setSelectedFile] = useState(null);
    const [newName, setNewName] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const { files: fullFiles, loading: fullLoading } = useFiles('full');
    const { files: slimFiles, loading: slimLoading } = useFiles('slim');
    const { files: snapshotFiles, loading: snapshotLoading } = useFiles('snapshots');

    const isLoading = fullLoading || slimLoading || snapshotLoading;

    const handleRename = async () => {
        try {
            startOperation(`Renaming file`);

            // Strip .sql extension if user added it
            const cleanName = newName.replace(/\.sql$/i, '');

            const renameResult = await window.dbManager.renameFile(selectedFile.path, cleanName);

            setResult(renameResult);
            setStep(4);
            endOperation();
        } catch (err) {
            setError(err.message);
            setStep(4);
            endOperation();
        }
    };

    const reset = () => {
        setStep(1);
        setSelectedFile(null);
        setNewName('');
        setResult(null);
        setError(null);
    };

    return (
        <div>
            {/* Step 1: Select File */}
            {step === 1 && (
                <div className="card">
                    <h3 className="font-bold mb-4">Select File to Rename</h3>
                    {isLoading ? (
                        <div className="text-center py-8 text-dark-muted">Loading files...</div>
                    ) : (
                        <div>
                            {/* File Lists by Category */}
                            <div className="space-y-4 max-h-96 overflow-y-auto mb-6">
                                {/* Full Dumps */}
                                {fullFiles.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-medium text-dark-muted mb-2">Full Dumps</h4>
                                        <div className="space-y-1">
                                            {fullFiles.map(file => (
                                                <label
                                                    key={file.path}
                                                    className="flex items-center gap-3 p-2 bg-dark-bg hover:bg-dark-border rounded cursor-pointer"
                                                >
                                                    <input
                                                        type="radio"
                                                        name="renameFile"
                                                        checked={selectedFile?.path === file.path}
                                                        onChange={() => {
                                                            setSelectedFile(file);
                                                            setNewName(file.name.replace(/\.sql$/i, ''));
                                                        }}
                                                        className="w-4 h-4"
                                                    />
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium">{file.name}</div>
                                                        <div className="text-xs text-dark-muted">
                                                            {((file.size || 0) / (1024 * 1024)) >= 1024
                                                                ? `${((file.size || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB`
                                                                : `${((file.size || 0) / (1024 * 1024)).toFixed(1)} MB`}
                                                        </div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Slim Dumps */}
                                {slimFiles.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-medium text-dark-muted mb-2">Slim Dumps</h4>
                                        <div className="space-y-1">
                                            {slimFiles.map(file => (
                                                <label
                                                    key={file.path}
                                                    className="flex items-center gap-3 p-2 bg-dark-bg hover:bg-dark-border rounded cursor-pointer"
                                                >
                                                    <input
                                                        type="radio"
                                                        name="renameFile"
                                                        checked={selectedFile?.path === file.path}
                                                        onChange={() => {
                                                            setSelectedFile(file);
                                                            setNewName(file.name.replace(/\.sql$/i, ''));
                                                        }}
                                                        className="w-4 h-4"
                                                    />
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium">{file.name}</div>
                                                        <div className="text-xs text-dark-muted">
                                                            {((file.size || 0) / (1024 * 1024)) >= 1024
                                                                ? `${((file.size || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB`
                                                                : `${((file.size || 0) / (1024 * 1024)).toFixed(1)} MB`}
                                                        </div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Snapshots */}
                                {snapshotFiles.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-medium text-dark-muted mb-2">Snapshots</h4>
                                        <div className="space-y-1">
                                            {snapshotFiles.slice(0, 10).map(file => (
                                                <label
                                                    key={file.path}
                                                    className="flex items-center gap-3 p-2 bg-dark-bg hover:bg-dark-border rounded cursor-pointer"
                                                >
                                                    <input
                                                        type="radio"
                                                        name="renameFile"
                                                        checked={selectedFile?.path === file.path}
                                                        onChange={() => {
                                                            setSelectedFile(file);
                                                            setNewName(file.name.replace(/\.sql$/i, ''));
                                                        }}
                                                        className="w-4 h-4"
                                                    />
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium">{file.name}</div>
                                                        <div className="text-xs text-dark-muted">
                                                            {((file.size || 0) / (1024 * 1024)) >= 1024
                                                                ? `${((file.size || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB`
                                                                : `${((file.size || 0) / (1024 * 1024)).toFixed(1)} MB`}
                                                        </div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button onClick={onBack} className="btn-secondary">
                            ← Back to Operations
                        </button>
                        <button
                            onClick={() => setStep(2)}
                            disabled={!selectedFile}
                            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Continue →
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Enter New Name */}
            {step === 2 && (
                <div className="card">
                    <h3 className="font-bold mb-4">Enter New Name</h3>
                    <div className="mb-4">
                        <span className="text-dark-muted">Current name:</span>
                        <span className="ml-2 font-medium">{selectedFile?.name}</span>
                    </div>
                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-2">New name</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Enter new filename (without .sql)"
                            className="input w-full"
                            autoFocus
                        />
                        <p className="text-xs text-dark-muted mt-1">
                            Extension .sql will be added automatically
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setStep(1)} className="btn-secondary">
                            ← Back
                        </button>
                        <button
                            onClick={() => setStep(3)}
                            disabled={!newName.trim()}
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
                    <h3 className="font-bold mb-4">Confirm Rename</h3>
                    <div className="bg-dark-bg rounded p-4 mb-6 space-y-3">
                        <div>
                            <span className="text-dark-muted">Old name:</span>
                            <span className="ml-2 font-medium text-red-400">{selectedFile?.name}</span>
                        </div>
                        <div>
                            <span className="text-dark-muted">New name:</span>
                            <span className="ml-2 font-medium text-green-400">{newName}.sql</span>
                        </div>
                        <div>
                            <span className="text-dark-muted">Size:</span>
                            <span className="ml-2">{((selectedFile?.size || 0) / (1024 * 1024)).toFixed(1)} MB</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setStep(2)} className="btn-secondary">
                            ← Back
                        </button>
                        <button onClick={handleRename} className="btn-primary">
                            Rename File
                        </button>
                    </div>
                </div>
            )}

            {/* Step 4: Result */}
            {step === 4 && (
                <div className="card">
                    {error ? (
                        <>
                            <h3 className="font-bold mb-4 text-red-400">❌ Rename Failed</h3>
                            <div className="bg-red-900/20 border border-red-500 rounded p-4 mb-4">
                                <p className="text-red-400 font-mono text-sm">{error}</p>
                            </div>
                            <button onClick={reset} className="btn-secondary">
                                ← Try Again
                            </button>
                        </>
                    ) : result ? (
                        <>
                            <h3 className="font-bold mb-4 text-green-400">✓ File Renamed</h3>
                            <div className="bg-green-900/20 border border-green-500 rounded p-4 mb-4">
                                <p className="mb-2">File renamed successfully!</p>
                                <div className="text-sm space-y-1">
                                    <div>
                                        <span className="text-dark-muted">New name:</span>
                                        <span className="ml-2 font-mono text-xs">{result.newPath}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={reset} className="btn-secondary">
                                    Rename Another File
                                </button>
                                <button onClick={onBack} className="btn-primary">
                                    ← Back to Operations
                                </button>
                            </div>
                        </>
                    ) : null}
                </div>
            )}
        </div>
    );
}

function ReplaceFlow({ onBack, startOperation, endOperation }) {
    const [step, setStep] = useState(1); // 1: Select Source, 2: Select Target, 3: Confirm, 4: Result
    const [sourcePath, setSourcePath] = useState('');
    const [targetFile, setTargetFile] = useState(null);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const { files: fullFiles } = useFiles('full');
    const { files: slimFiles } = useFiles('slim');

    // Only show full and slim files (not snapshots)
    const replaceableFiles = [...fullFiles, ...slimFiles];

    const handleSelectSource = async () => {
        try {
            const filePath = await window.dbManager.selectFile({
                title: 'Select source SQL file',
                filters: [{ name: 'SQL Files', extensions: ['sql'] }]
            });

            if (filePath) {
                setSourcePath(filePath);
                setStep(2);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const handleReplace = async () => {
        try {
            startOperation('Replacing file');

            const replaceResult = await window.dbManager.replaceFile(sourcePath, targetFile.path);

            setResult(replaceResult);
            setStep(4);
            endOperation();
        } catch (err) {
            setError(err.message);
            setStep(4);
            endOperation();
        }
    };

    const reset = () => {
        setStep(1);
        setSourcePath('');
        setTargetFile(null);
        setResult(null);
        setError(null);
    };

    return (
        <div>
            {/* Step 1: Select Source File */}
            {step === 1 && (
                <div className="card">
                    <h3 className="font-bold mb-4">Select Source File</h3>
                    <p className="text-dark-muted mb-6">
                        Choose the new SQL file that will replace an existing dump.
                    </p>

                    <button onClick={handleSelectSource} className="btn-primary mb-6">
                        📂 Browse for SQL File
                    </button>

                    {sourcePath && (
                        <div className="bg-blue-900/20 border border-blue-500/50 rounded p-4 mb-4">
                            <p className="text-sm text-blue-300">
                                Selected: <span className="font-mono text-xs">{sourcePath}</span>
                            </p>
                        </div>
                    )}

                    <button onClick={onBack} className="btn-secondary">
                        ← Back to Operations
                    </button>
                </div>
            )}

            {/* Step 2: Select Target File */}
            {step === 2 && (
                <div className="card">
                    <h3 className="font-bold mb-4">Select Target File to Replace</h3>
                    <div className="mb-4">
                        <span className="text-dark-muted">Source:</span>
                        <span className="ml-2 font-mono text-xs">{sourcePath}</span>
                    </div>

                    {replaceableFiles.length === 0 ? (
                        <div className="text-center py-8 text-dark-muted">
                            No replaceable files found
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto mb-6">
                            {replaceableFiles.map((file) => (
                                <button
                                    key={file.path}
                                    onClick={() => {
                                        setTargetFile(file);
                                        setStep(3);
                                    }}
                                    className="w-full p-3 bg-dark-bg hover:bg-dark-border rounded text-left transition-colors"
                                >
                                    <div className="font-medium">{file.name}</div>
                                    <div className="text-sm text-dark-muted">
                                        {file.path}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    <button onClick={() => setStep(1)} className="btn-secondary">
                        ← Back
                    </button>
                </div>
            )}

            {/* Step 3: Confirm */}
            {step === 3 && (
                <div className="card">
                    <h3 className="font-bold mb-4">Confirm File Replacement</h3>

                    <div className="bg-dark-bg rounded p-4 mb-6 space-y-3">
                        <div>
                            <span className="text-dark-muted">Source (new file):</span>
                            <div className="ml-2 font-mono text-xs mt-1">{sourcePath}</div>
                        </div>
                        <div>
                            <span className="text-dark-muted">Target (will be replaced):</span>
                            <div className="ml-2 font-mono text-xs mt-1">{targetFile?.path}</div>
                        </div>
                    </div>

                    <div className="bg-red-900/20 border border-red-500 rounded p-4 mb-6">
                        <p className="text-red-400 font-medium">⚠️ Warning</p>
                        <p className="text-sm mt-1">
                            The target file will be permanently replaced. This action cannot be undone.
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => setStep(2)} className="btn-secondary">
                            ← Back
                        </button>
                        <button onClick={handleReplace} className="btn-primary">
                            Replace File
                        </button>
                    </div>
                </div>
            )}

            {/* Step 4: Result */}
            {step === 4 && (
                <div className="card">
                    {error ? (
                        <>
                            <h3 className="font-bold mb-4 text-red-400">❌ Replace Failed</h3>
                            <div className="bg-red-900/20 border border-red-500 rounded p-4 mb-4">
                                <p className="text-red-400 font-mono text-sm">{error}</p>
                            </div>
                            <button onClick={reset} className="btn-secondary">
                                ← Try Again
                            </button>
                        </>
                    ) : result ? (
                        <>
                            <h3 className="font-bold mb-4 text-green-400">✓ File Replaced</h3>
                            <div className="bg-green-900/20 border border-green-500 rounded p-4 mb-4">
                                <p className="mb-2">File replaced successfully!</p>
                                <div className="text-sm space-y-1">
                                    <div>
                                        <span className="text-dark-muted">Target file has been updated</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={reset} className="btn-secondary">
                                    Replace Another File
                                </button>
                                <button onClick={onBack} className="btn-primary">
                                    ← Back to Operations
                                </button>
                            </div>
                        </>
                    ) : null}
                </div>
            )}
        </div>
    );
}

function DeleteFlow({ onBack, startOperation, endOperation }) {
    const [step, setStep] = useState(1); // 1: Select Files, 2: Confirm, 3: Result
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const { files: fullFiles } = useFiles('full');
    const { files: slimFiles } = useFiles('slim');
    const { files: snapshotFiles } = useFiles('snapshots');

    // Calculate total size of selected files
    const calculateTotalSize = (files) => {
        const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
        const sizeInMB = totalBytes / (1024 * 1024);
        return sizeInMB >= 1024
            ? `${(sizeInMB / 1024).toFixed(2)} GB`
            : `${sizeInMB.toFixed(1)} MB`;
    };

    const toggleFileSelection = (file) => {
        setSelectedFiles(prev => {
            const isSelected = prev.some(f => f.path === file.path);
            if (isSelected) {
                return prev.filter(f => f.path !== file.path);
            } else {
                return [...prev, file];
            }
        });
    };

    const selectAllCategory = (category) => {
        const categoryFiles = category === 'full' ? fullFiles : category === 'slim' ? slimFiles : snapshotFiles;
        setSelectedFiles(prev => {
            // Remove duplicates and add new ones
            const filtered = prev.filter(f => !categoryFiles.some(cf => cf.path === f.path));
            return [...filtered, ...categoryFiles];
        });
    };

    const handleDelete = async () => {
        try {
            startOperation(`Deleting ${selectedFiles.length} files`);

            const filePaths = selectedFiles.map(f => f.path);
            const deleteResult = await window.dbManager.deleteFiles(filePaths);

            setResult(deleteResult);
            setStep(3);
            endOperation();
        } catch (err) {
            setError(err.message);
            setStep(3);
            endOperation();
        }
    };

    const reset = () => {
        setStep(1);
        setSelectedFiles([]);
        setResult(null);
        setError(null);
    };

    const totalSize = calculateTotalSize(selectedFiles);

    return (
        <div>
            {/* Step 1: Select Files */}
            {step === 1 && (
                <div className="card">
                    <h3 className="font-bold mb-4">Select Files to Delete</h3>

                    {/* Bulk Selection Buttons */}
                    <div className="grid grid-cols-3 gap-2 mb-6">
                        <button
                            onClick={() => selectAllCategory('full')}
                            className="p-3 bg-dark-bg hover:bg-dark-border rounded text-sm"
                        >
                            Select All Full
                            <div className="text-xs text-dark-muted mt-1">
                                {fullFiles.length} files • {calculateTotalSize(fullFiles)}
                            </div>
                        </button>
                        <button
                            onClick={() => selectAllCategory('slim')}
                            className="p-3 bg-dark-bg hover:bg-dark-border rounded text-sm"
                        >
                            Select All Slim
                            <div className="text-xs text-dark-muted mt-1">
                                {slimFiles.length} files • {calculateTotalSize(slimFiles)}
                            </div>
                        </button>
                        <button
                            onClick={() => selectAllCategory('snapshots')}
                            className="p-3 bg-dark-bg hover:bg-dark-border rounded text-sm"
                        >
                            Select All Snapshots
                            <div className="text-xs text-dark-muted mt-1">
                                {snapshotFiles.length} files • {calculateTotalSize(snapshotFiles)}
                            </div>
                        </button>
                    </div>

                    {/* File Lists by Category */}
                    <div className="space-y-4 max-h-96 overflow-y-auto mb-6">
                        {/* Full Dumps */}
                        {fullFiles.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-dark-muted mb-2">Full Dumps</h4>
                                <div className="space-y-1">
                                    {fullFiles.map(file => (
                                        <label
                                            key={file.path}
                                            className="flex items-center gap-3 p-2 bg-dark-bg hover:bg-dark-border rounded cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedFiles.some(f => f.path === file.path)}
                                                onChange={() => toggleFileSelection(file)}
                                                className="w-4 h-4"
                                            />
                                            <div className="flex-1">
                                                <div className="text-sm font-medium">{file.name}</div>
                                                <div className="text-xs text-dark-muted">
                                                    {((file.size || 0) / (1024 * 1024)) >= 1024
                                                        ? `${((file.size || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB`
                                                        : `${((file.size || 0) / (1024 * 1024)).toFixed(1)} MB`}
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Slim Dumps */}
                        {slimFiles.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-dark-muted mb-2">Slim Dumps</h4>
                                <div className="space-y-1">
                                    {slimFiles.map(file => (
                                        <label
                                            key={file.path}
                                            className="flex items-center gap-3 p-2 bg-dark-bg hover:bg-dark-border rounded cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedFiles.some(f => f.path === file.path)}
                                                onChange={() => toggleFileSelection(file)}
                                                className="w-4 h-4"
                                            />
                                            <div className="flex-1">
                                                <div className="text-sm font-medium">{file.name}</div>
                                                <div className="text-xs text-dark-muted">
                                                    {((file.size || 0) / (1024 * 1024)) >= 1024
                                                        ? `${((file.size || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB`
                                                        : `${((file.size || 0) / (1024 * 1024)).toFixed(1)} MB`}
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Snapshots */}
                        {snapshotFiles.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-dark-muted mb-2">Snapshots</h4>
                                <div className="space-y-1">
                                    {snapshotFiles.map(file => (
                                        <label
                                            key={file.path}
                                            className="flex items-center gap-3 p-2 bg-dark-bg hover:bg-dark-border rounded cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedFiles.some(f => f.path === file.path)}
                                                onChange={() => toggleFileSelection(file)}
                                                className="w-4 h-4"
                                            />
                                            <div className="flex-1">
                                                <div className="text-sm font-medium">{file.name}</div>
                                                <div className="text-xs text-dark-muted">
                                                    {((file.size || 0) / (1024 * 1024)) >= 1024
                                                        ? `${((file.size || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB`
                                                        : `${((file.size || 0) / (1024 * 1024)).toFixed(1)} MB`}
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Selection Summary */}
                    {selectedFiles.length > 0 && (
                        <div className="bg-blue-900/20 border border-blue-500/50 rounded p-4 mb-4">
                            <p className="text-sm text-blue-300">
                                Selected: {selectedFiles.length} files • Total size: {totalSize}
                            </p>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button onClick={onBack} className="btn-secondary">
                            ← Back to Operations
                        </button>
                        <button
                            onClick={() => setStep(2)}
                            disabled={selectedFiles.length === 0}
                            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Continue → ({selectedFiles.length} files)
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Confirm */}
            {step === 2 && (
                <div className="card">
                    <h3 className="font-bold mb-4">Confirm Deletion</h3>

                    <div className="bg-dark-bg rounded p-4 mb-4">
                        <h4 className="font-medium mb-2">Files to delete:</h4>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                            {selectedFiles.map(file => (
                                <div key={file.path} className="text-sm">
                                    • {file.name}
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 pt-3 border-t border-dark-border">
                            <div className="font-medium">Total space to free: {totalSize}</div>
                        </div>
                    </div>

                    <div className="bg-red-900/20 border border-red-500 rounded p-4 mb-6">
                        <p className="text-red-400 font-medium">⚠️ Warning</p>
                        <p className="text-sm mt-1">
                            This action CANNOT be undone! {selectedFiles.length} files will be permanently deleted.
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => setStep(1)} className="btn-secondary">
                            ← Back
                        </button>
                        <button onClick={handleDelete} className="btn-primary bg-red-600 hover:bg-red-700">
                            Delete {selectedFiles.length} Files
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Result */}
            {step === 3 && (
                <div className="card">
                    {error ? (
                        <>
                            <h3 className="font-bold mb-4 text-red-400">❌ Deletion Failed</h3>
                            <div className="bg-red-900/20 border border-red-500 rounded p-4 mb-4">
                                <p className="text-red-400 font-mono text-sm">{error}</p>
                            </div>
                            <button onClick={reset} className="btn-secondary">
                                ← Try Again
                            </button>
                        </>
                    ) : result ? (
                        <>
                            <h3 className="font-bold mb-4 text-green-400">✓ Files Deleted</h3>
                            <div className="bg-green-900/20 border border-green-500 rounded p-4 mb-4">
                                <p className="mb-2">Successfully deleted {result.count} files!</p>
                                <div className="text-sm space-y-1">
                                    <div>
                                        <span className="text-dark-muted">Space freed: {totalSize}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={reset} className="btn-secondary">
                                    Delete More Files
                                </button>
                                <button onClick={onBack} className="btn-primary">
                                    ← Back to Operations
                                </button>
                            </div>
                        </>
                    ) : null}
                </div>
            )}
        </div>
    );
}

export default ManageFiles;
