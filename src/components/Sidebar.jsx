import { NavLink } from 'react-router-dom';
import { useOperation } from '../contexts/OperationContext';

const navigation = [
    {
        name: 'Restore Database',
        path: '/restore',
        icon: '📥',
        description: 'Restore from SQL dumps'
    },
    {
        name: 'Create Slim Dumps',
        path: '/slim',
        icon: '✂️',
        description: 'Generate reduced dumps'
    },
    {
        name: 'Create Snapshot',
        path: '/snapshot',
        icon: '📸',
        description: 'Backup local database'
    },
    {
        type: 'separator'
    },
    {
        name: 'Delete Databases',
        path: '/delete-databases',
        icon: '🗄️',
        description: 'Remove unused databases'
    },
    {
        name: 'Settings',
        path: '/settings',
        icon: '⚙️',
        description: 'Configure MySQL & paths'
    },
    {
        type: 'separator'
    },
    {
        name: 'Manage Files',
        path: '/manage-files',
        icon: '📁',
        description: 'Rename, replace, or delete'
    },
];

function Sidebar() {
    const { isOperationActive, activeOperation } = useOperation();

    return (
        <div className="w-64 bg-dark-surface border-r border-dark-border flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-dark-border">
                <h1 className="text-xl font-bold text-primary-400">Database Manager</h1>
                <p className="text-sm text-dark-muted mt-1">MySQL Tool</p>
            </div>

            {/* Active operation warning */}
            {isOperationActive && (
                <div className="mx-4 mt-4 p-3 bg-yellow-900/20 border border-yellow-500/50 rounded text-xs">
                    <p className="text-yellow-400 font-medium">⚠️ Operation in progress</p>
                    <p className="text-yellow-300/70 mt-1">{activeOperation}</p>
                </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {navigation.map((item, index) => {
                    if (item.type === 'separator') {
                        return (
                            <div
                                key={index}
                                className="my-3 border-t border-dark-border"
                            />
                        );
                    }

                    const isDisabled = isOperationActive;

                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={(e) => {
                                if (isDisabled) {
                                    e.preventDefault();
                                }
                            }}
                            className={({ isActive }) =>
                                `${isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'} ${
                                    isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                                }`
                            }
                        >
                            <span className="text-xl emoji-no-color">{item.icon}</span>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{item.name}</div>
                                <div className="text-xs opacity-75 truncate">
                                    {item.description}
                                </div>
                            </div>
                        </NavLink>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-dark-border">
                <p className="text-xs text-dark-muted text-center">
                    v1.0.0 • Electron GUI
                </p>
            </div>
        </div>
    );
}

export default Sidebar;
