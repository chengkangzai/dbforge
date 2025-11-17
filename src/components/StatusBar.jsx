import { useState, useEffect } from 'react';

function StatusBar() {
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleTimeString());

    useEffect(() => {
        // Test MySQL connection on mount
        testConnection();

        // Update time every second
        const timer = setInterval(() => {
            setLastUpdate(new Date().toLocaleTimeString());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const testConnection = async () => {
        try {
            setConnectionStatus('connecting');
            const result = await window.dbManager.testConnection();
            setConnectionStatus(result.success ? 'connected' : 'error');
        } catch (error) {
            console.error('Connection test failed:', error);
            setConnectionStatus('error');
        }
    };

    const getStatusColor = () => {
        switch (connectionStatus) {
            case 'connected':
                return 'bg-green-500';
            case 'connecting':
                return 'bg-yellow-500 animate-pulse';
            case 'error':
                return 'bg-red-500';
            default:
                return 'bg-gray-500';
        }
    };

    const getStatusText = () => {
        switch (connectionStatus) {
            case 'connected':
                return 'Connected';
            case 'connecting':
                return 'Connecting...';
            case 'error':
                return 'Connection Error';
            default:
                return 'Disconnected';
        }
    };

    return (
        <div className="h-8 bg-dark-surface border-t border-dark-border flex items-center justify-between px-4 text-xs text-dark-muted">
            {/* Left side - Connection status */}
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
                <span>{getStatusText()}</span>
                {connectionStatus !== 'connected' && (
                    <button
                        onClick={testConnection}
                        className="ml-2 text-primary-400 hover:text-primary-300"
                    >
                        Retry
                    </button>
                )}
            </div>

            {/* Center - Working directory */}
            <div className="flex-1 text-center">
                <span className="text-dark-text">~/db/</span>
            </div>

            {/* Right side - Time */}
            <div>
                {lastUpdate}
            </div>
        </div>
    );
}

export default StatusBar;
