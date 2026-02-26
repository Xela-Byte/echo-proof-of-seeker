/**
 * App Context - Simplified for Expo Router
 */

import React, { createContext, ReactNode, useContext } from 'react';

interface AppContextType {
  // Add your app-wide state here
  version: string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const value: AppContextType = {
    version: '1.0.0',
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
