import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { OperationProvider } from './contexts/OperationContext';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import Restore from './components/Restore';
import Slim from './components/Slim';
import Snapshot from './components/Snapshot';
import DeleteDatabases from './components/DeleteDatabases';
import Settings from './components/Settings';
import ManageFiles from './components/ManageFiles';
import FirstRun from './components/FirstRun';

function App() {
    const [isFirstRun, setIsFirstRun] = useState(null);

    useEffect(() => {
        const checkFirstRun = async () => {
            const firstRun = await window.dbManager.isFirstRun();
            setIsFirstRun(firstRun);
        };
        checkFirstRun();
    }, []);

    const handleFirstRunComplete = () => {
        setIsFirstRun(false);
    };

    // Show loading while checking first run status
    if (isFirstRun === null) {
        return (
            <div className="flex items-center justify-center h-screen bg-dark-bg">
                <p className="text-dark-muted">Loading...</p>
            </div>
        );
    }

    // Show first run wizard
    if (isFirstRun) {
        return <FirstRun onComplete={handleFirstRunComplete} />;
    }

    // Show main app
    return (
        <OperationProvider>
            <div className="flex h-screen overflow-hidden">
                {/* Sidebar */}
                <Sidebar />

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Content Area */}
                <main className="flex-1 overflow-y-auto p-6">
                    <Routes>
                        <Route path="/" element={<Navigate to="/restore" replace />} />
                        <Route path="/restore" element={<Restore />} />
                        <Route path="/slim" element={<Slim />} />
                        <Route path="/snapshot" element={<Snapshot />} />
                        <Route path="/delete-databases" element={<DeleteDatabases />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/manage-files" element={<ManageFiles />} />
                    </Routes>
                </main>

                {/* Status Bar */}
                <StatusBar />
            </div>
        </div>
        </OperationProvider>
    );
}

export default App;
