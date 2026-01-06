
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, getAssetUrl } from '../lib/supabase';

export type MiniModel = 'r53' | 'r52' | 'r56' | 'r55' | 'f56' | 'f56lci' | 'f54' | 'f54lci' | 'j01';

interface ThemeConfig {
  id: MiniModel;
  name: string;
  years: string;
  color: string;
  carImageUrl: string;
}

// Model Definitions using Supabase Storage
// Images should be uploaded to bucket 'nmcs-assets' in folder 'models'
export const MODELS: ThemeConfig[] = [
  { 
      id: 'r53', 
      name: 'R50/R53', 
      years: '2001-2006', 
      color: '#E21D38', // Chili Red
      carImageUrl: getAssetUrl('models/r53.png')
  },
  { 
      id: 'r52', 
      name: 'R52 Convertible', 
      years: '2004-2008', 
      color: '#0ea5e9', // Cool Blue / Sky Blue
      carImageUrl: getAssetUrl('models/r52.png')
  },
  { 
      id: 'r56', 
      name: 'R56', 
      years: '2006-2013', 
      color: '#FCD34D', // Mellow Yellow
      carImageUrl: getAssetUrl('models/r56.png')
  },
  { 
      id: 'r55', 
      name: 'R55 Clubman', 
      years: '2007-2014', 
      color: '#b45309', // Hot Chocolate / Bronze
      carImageUrl: getAssetUrl('models/r55.png')
  },
  { 
      id: 'f56', 
      name: 'F56', 
      years: '2014-2018', 
      color: '#F97316', // Volcanic Orange
      carImageUrl: getAssetUrl('models/f56.png')
  },
  { 
      id: 'f56lci', 
      name: 'F56 LCI', 
      years: '2018-2023', 
      color: '#16a34a', // British Racing Green IV
      carImageUrl: getAssetUrl('models/f56lci.png')
  },
  { 
      id: 'f54', 
      name: 'Clubman F54', 
      years: '2015-2019', 
      color: '#3B82F6', // Island Blue
      carImageUrl: getAssetUrl('models/f54.png')
  },
  { 
      id: 'f54lci', 
      name: 'Clubman F54 LCI', 
      years: '2019-2024', 
      color: '#6366f1', // Starlight Blue
      carImageUrl: getAssetUrl('models/f54lci.png')
  },
  { 
      id: 'j01', 
      name: 'J01 / F66', 
      years: '2024+', 
      color: '#0ea5e9', // Blazing Blue
      carImageUrl: getAssetUrl('models/j01.jpg') // Fixed extension based on screenshot
  },
];

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  model: MiniModel;
  setModel: (model: MiniModel) => void;
  currentTheme: ThemeConfig;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Dark mode is device specific, keep in localStorage
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('nmcs_dark_mode');
    return saved ? JSON.parse(saved) : false;
  });

  // Model is User specific. Default to localStorage for guests.
  const [model, setModelState] = useState<MiniModel>(() => {
    const saved = localStorage.getItem('nmcs_car_model');
    // Ensure the saved model is valid, otherwise default
    return MODELS.some(m => m.id === saved) ? (saved as MiniModel) : 'r53';
  });

  // 1. Listen for Auth Changes to load User Preference from Supabase
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
            // Fetch profile preference
            const { data } = await supabase
                .from('profiles')
                .select('car_model')
                .eq('id', session.user.id)
                .single();
            
            if (data?.car_model) {
                // If DB has a valid model, use it
                if (MODELS.some(m => m.id === data.car_model)) {
                    setModelState(data.car_model as MiniModel);
                    localStorage.setItem('nmcs_car_model', data.car_model);
                }
            }
        }
    });

    return () => subscription.unsubscribe();
  }, []);

  const setModel = async (newModel: MiniModel) => {
    // 1. Update Local State immediately for UI responsiveness
    setModelState(newModel);
    localStorage.setItem('nmcs_car_model', newModel);

    // 2. If logged in, persist to Supabase
    // This ensures User A gets their model and User B gets theirs when they log in on different devices
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
        await supabase
            .from('profiles')
            .update({ car_model: newModel })
            .eq('id', session.user.id);
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev: boolean) => {
      const newVal = !prev;
      localStorage.setItem('nmcs_dark_mode', JSON.stringify(newVal));
      return newVal;
    });
  };

  // Handle Dark Mode Class
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Handle Dynamic Primary Color
  useEffect(() => {
    const theme = MODELS.find(m => m.id === model) || MODELS[0];
    document.documentElement.style.setProperty('--mini-primary', theme.color);
  }, [model]);

  const currentTheme = MODELS.find(m => m.id === model) || MODELS[0];

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, model, setModel, currentTheme }}>
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
