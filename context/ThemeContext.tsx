import React, { createContext, useContext, useEffect, useState } from 'react';

export type MiniGeneration = 'gen1' | 'gen2' | 'gen3' | 'gen4' | 'jcw';

interface ThemeConfig {
  id: MiniGeneration;
  name: string;
  years: string;
  color: string; // The hex code for the primary accent
}

export const GENERATIONS: ThemeConfig[] = [
  { id: 'gen1', name: 'R50/R53', years: '2001-2006', color: '#E21D38' }, // Chili Red
  { id: 'gen2', name: 'R56', years: '2006-2013', color: '#FCD34D' }, // Mellow Yellow-ish
  { id: 'gen3', name: 'F56', years: '2014-2023', color: '#F97316' }, // Volcanic Orange
  { id: 'gen4', name: 'J01/F66', years: '2024+', color: '#3B82F6' }, // Electric Blue
  { id: 'jcw', name: 'JCW Pro', years: 'Track Spec', color: '#16a34a' }, // Rebel Green vibe
];

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  generation: MiniGeneration;
  setGeneration: (gen: MiniGeneration) => void;
  currentTheme: ThemeConfig;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [generation, setGeneration] = useState<MiniGeneration>('gen1');

  // Handle Dark Mode Class
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Handle Dynamic Primary Color based on Generation
  useEffect(() => {
    const theme = GENERATIONS.find(g => g.id === generation) || GENERATIONS[0];
    document.documentElement.style.setProperty('--mini-primary', theme.color);
  }, [generation]);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  const currentTheme = GENERATIONS.find(g => g.id === generation) || GENERATIONS[0];

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, generation, setGeneration, currentTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};