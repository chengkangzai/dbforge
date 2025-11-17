import { useState, useEffect } from 'react';

export function useDatabase() {
    const [databases, setDatabases] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadDatabases = async () => {
        try {
            setLoading(true);
            setError(null);
            const dbs = await window.dbManager.getDatabases();
            setDatabases(dbs);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDatabases();
    }, []);

    const getDatabaseInfo = async (dbName) => {
        try {
            return await window.dbManager.getDatabaseInfo(dbName);
        } catch (err) {
            console.error('Failed to get database info:', err);
            return { tableCount: 0, sizeMB: 0 };
        }
    };

    return {
        databases,
        loading,
        error,
        reload: loadDatabases,
        getDatabaseInfo
    };
}

export function useFiles(directory) {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadFiles = async () => {
        if (!directory) {
            console.log('⚠️ useFiles: No directory specified');
            return;
        }

        try {
            console.log('🔍 useFiles: Loading files from directory:', directory);
            setLoading(true);
            setError(null);
            const discoveredFiles = await window.dbManager.discoverSqlFiles(directory);
            console.log('✅ useFiles: Discovered files:', discoveredFiles);
            setFiles(discoveredFiles);
        } catch (err) {
            console.error('❌ useFiles: Error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFiles();
    }, [directory]);

    return {
        files,
        loading,
        error,
        reload: loadFiles
    };
}
