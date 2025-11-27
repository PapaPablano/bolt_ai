import { createContext, useContext, useState, type ReactNode } from 'react';

type Ctx = {
  open: boolean;
  setOpen(v: boolean | ((prev: boolean) => boolean)): void;
};

const OptionsDockContext = createContext<Ctx | null>(null);

export function OptionsDockProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <OptionsDockContext.Provider value={{ open, setOpen }}>
      {children}
    </OptionsDockContext.Provider>
  );
}

export function useOptionsDock() {
  const ctx = useContext(OptionsDockContext);
  if (!ctx) throw new Error('useOptionsDock must be used inside OptionsDockProvider');
  return ctx;
}
