import { createContext, useContext, useState } from 'react';

const OperationContext = createContext();

export function OperationProvider({ children }) {
    const [activeOperation, setActiveOperation] = useState(null);

    const startOperation = (operationName) => {
        setActiveOperation(operationName);
    };

    const endOperation = () => {
        setActiveOperation(null);
    };

    const value = {
        activeOperation,
        isOperationActive: !!activeOperation,
        startOperation,
        endOperation
    };

    return (
        <OperationContext.Provider value={value}>
            {children}
        </OperationContext.Provider>
    );
}

export function useOperation() {
    const context = useContext(OperationContext);
    if (!context) {
        throw new Error('useOperation must be used within OperationProvider');
    }
    return context;
}
