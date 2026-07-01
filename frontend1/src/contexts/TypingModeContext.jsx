import { createContext, useContext, useState, useEffect } from 'react';

// Global typing-mode preference for all text inputs across the app.
// 'english'  -> normal typing, Latin font
// 'mangal'   -> Hindi Unicode typing via the OS/browser Hindi (Devanagari) keyboard,
//               rendered in Mangal font (no conversion needed - it's already Unicode)
// 'krutidev' -> legacy KrutiDev-layout typing, live-converted to Unicode Devanagari
const TypingModeContext = createContext(null);
const STORAGE_KEY = 'dutyops_typing_mode';

export function TypingModeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem(STORAGE_KEY) || 'mangal');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  return (
    <TypingModeContext.Provider value={{ mode, setMode }}>
      {children}
    </TypingModeContext.Provider>
  );
}

export function useTypingMode() {
  const ctx = useContext(TypingModeContext);
  if (!ctx) throw new Error('useTypingMode must be used within TypingModeProvider');
  return ctx;
}
