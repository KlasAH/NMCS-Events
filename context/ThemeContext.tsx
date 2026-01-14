
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, getAssetUrl, isDemoMode } from '../lib/supabase';

export type MiniModel = 'r53' | 'r52' | 'r56' | 'r55' | 'f56' | 'f56lci' | 'f54' | 'f54lci' | 'j01' | 'gp1' | 'gp2' | 'gp3';

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
      id: 'gp1', 
      name: 'Mini GP1', 
      years: '2006', 
      color: '#5d7389', // Thunder Blue
      carImageUrl: getAssetUrl('models/gp1.png')
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
      id: 'gp2', 
      name: 'Mini GP2', 
      years: '2013', 
      color: '#4b5563', // Thunder Grey
      carImageUrl: getAssetUrl('models/gp2.png')
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
      id: 'gp3', 
      name: 'Mini GP3', 
      years: '2020', 
      color: '#9ca3af', // Racing Grey
      carImageUrl: getAssetUrl('models/gp3.png')
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
      carImageUrl: getAssetUrl('models/j01.jpg')
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

// Helper to determine Swedish Seasonal Theme
const getSeasonalTheme = (): MiniModel | null => {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    const day = now.getDate();

    // 1. Christmas (Dec 1 - Dec 31) -> Red (R53)
    if (month === 11) return 'r53';

    // 2. Halloween / All Saints (Oct 25 - Nov 5) -> Orange (F56)
    if ((month === 9 && day >= 25) || (month === 10 && day <= 5)) return 'f56';

    // 3. Swedish National Day (June 6) -> Blue/Yellow -> Use Blue (F54 or R52)
    if (month === 5 && day === 6) return 'f54';

    // 4. Easter (Approx March/April) -> Yellow (R56)
    // Heuristic: Late March to April
    if (month === 3) return 'r56';

    // 5. Midsummer (Late June) -> Green (Nature) -> F56 LCI
    if (month === 5 && day >= 19 && day <= 26) return 'f56lci';

    // 6. Summer Season (July - Aug) -> Convertible (R52)
    if (month === 6 || month === 7) return 'r52';

    // 7. Winter/New Year (Jan - Feb) -> GP3 (Grey/Cold)
    if (month === 0 || month === 1) return 'gp3';

    return null; 
};

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

  // Check for Auto-Theme Setting on Mount
  useEffect(() => {
    if (isDemoMode) return;

    const checkAutoTheme = async () => {
        const { data } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'auto_theme_switching')
            .maybeSingle();

        if (data?.value === 'true') {
            const seasonalTheme = getSeasonalTheme();
            if (seasonalTheme) {
                console.log(`[Theme] Auto-switching to seasonal theme: ${seasonalTheme}`);
                setModelState(seasonalTheme);
                // We do NOT save to localStorage here to avoid overwriting user preference permanently
                // if they turn off the auto-switch later.
            }
        }
    };

    checkAutoTheme();
  }, []);

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
                // If DB has a valid model, use it (This might override Auto-Theme if user specifically logs in)
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
