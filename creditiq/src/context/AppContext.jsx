import { createContext, useContext, useState } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [portfolio, setPortfolio] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  return (
    <AppContext.Provider value={{ portfolio, setPortfolio, selectedCustomerId, setSelectedCustomerId }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
