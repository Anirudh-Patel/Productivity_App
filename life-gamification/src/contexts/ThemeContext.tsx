import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRenderPerformance } from '../utils/performance';

export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: {
    background: string;
    foreground: string;
    primary: string;
    secondary: string;
    accent: string;
    muted: string;
    success: string;
    warning: string;
    error: string;
  };
  gradients: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export const themes: Record<string, Theme> = {
  'solo-leveling': {
    id: 'solo-leveling',
    name: 'Solo Leveling',
    description: 'Dark manhwa-inspired theme with blue accents',
    colors: {
      background: '10 14 26', // #0A0E1A
      foreground: '229 231 235', // #E5E7EB
      primary: '30 42 58', // #1E2A3A
      secondary: '55 65 81', // #374151
      accent: '0 212 255', // #00D4FF
      muted: '107 114 128', // #6B7280
      success: '16 185 129', // #10B981
      warning: '245 158 11', // #F59E0B
      error: '239 68 68', // #EF4444
    },
    gradients: {
      primary: 'linear-gradient(135deg, rgb(0 212 255) 0%, rgb(55 65 81) 100%)',
      secondary: 'linear-gradient(135deg, rgb(55 65 81) 0%, rgb(30 42 58) 100%)',
      accent: 'linear-gradient(135deg, rgb(0 212 255) 0%, rgb(59 130 246) 100%)',
    }
  },
  'attack-on-titan': {
    id: 'attack-on-titan',
    name: 'Attack on Titan',
    description: 'Military green theme inspired by the Survey Corps',
    colors: {
      background: '20 25 20', // #141914
      foreground: '240 240 240', // #F0F0F0
      primary: '40 50 40', // #283228
      secondary: '60 70 50', // #3C4632
      accent: '134 154 82', // #869A52
      muted: '120 130 110', // #78826E
      success: '82 154 134', // #529A86
      warning: '218 165 32', // #DAA520
      error: '205 92 92', // #CD5C5C
    },
    gradients: {
      primary: 'linear-gradient(135deg, rgb(134 154 82) 0%, rgb(60 70 50) 100%)',
      secondary: 'linear-gradient(135deg, rgb(60 70 50) 0%, rgb(40 50 40) 100%)',
      accent: 'linear-gradient(135deg, rgb(134 154 82) 0%, rgb(82 154 134) 100%)',
    }
  },
  'one-piece': {
    id: 'one-piece',
    name: 'One Piece',
    description: 'Vibrant pirate theme with orange and red accents',
    colors: {
      background: '26 18 14', // #1A120E
      foreground: '255 248 240', // #FFF8F0
      primary: '58 42 34', // #3A2A22
      secondary: '139 69 19', // #8B4513
      accent: '255 140 0', // #FF8C00
      muted: '160 120 90', // #A0785A
      success: '255 165 0', // #FFA500
      warning: '255 69 0', // #FF4500
      error: '220 20 60', // #DC143C
    },
    gradients: {
      primary: 'linear-gradient(135deg, rgb(255 140 0) 0%, rgb(139 69 19) 100%)',
      secondary: 'linear-gradient(135deg, rgb(139 69 19) 0%, rgb(58 42 34) 100%)',
      accent: 'linear-gradient(135deg, rgb(255 140 0) 0%, rgb(255 165 0) 100%)',
    }
  },
  'demon-slayer': {
    id: 'demon-slayer',
    name: 'Demon Slayer',
    description: 'Traditional Japanese theme with purple and teal',
    colors: {
      background: '15 10 25', // #0F0A19
      foreground: '248 250 252', // #F8FAFC
      primary: '35 25 45', // #23192D
      secondary: '75 65 95', // #4B415F
      accent: '147 51 234', // #9333EA
      muted: '156 163 175', // #9CA3AF
      success: '20 184 166', // #14B8A6
      warning: '251 191 36', // #FBBF24
      error: '244 63 94', // #F43F5E
    },
    gradients: {
      primary: 'linear-gradient(135deg, rgb(147 51 234) 0%, rgb(75 65 95) 100%)',
      secondary: 'linear-gradient(135deg, rgb(75 65 95) 0%, rgb(35 25 45) 100%)',
      accent: 'linear-gradient(135deg, rgb(147 51 234) 0%, rgb(20 184 166) 100%)',
    }
  }
};

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (themeId: string) => void;
  availableThemes: Theme[];
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  useRenderPerformance('ThemeProvider', process.env.NODE_ENV === 'development');
  
  const [currentThemeId, setCurrentThemeId] = useState('solo-leveling');
  
  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('life-quest-theme');
    if (savedTheme && themes[savedTheme]) {
      setCurrentThemeId(savedTheme);
    }
  }, []);
  
  // Apply theme CSS variables when theme changes
  useEffect(() => {
    const theme = themes[currentThemeId];
    if (!theme) return;
    
    const root = document.documentElement;
    
    // Apply CSS custom properties
    root.style.setProperty('--background', theme.colors.background);
    root.style.setProperty('--foreground', theme.colors.foreground);
    root.style.setProperty('--primary', theme.colors.primary);
    root.style.setProperty('--secondary', theme.colors.secondary);
    root.style.setProperty('--accent', theme.colors.accent);
    root.style.setProperty('--muted', theme.colors.muted);
    root.style.setProperty('--success', theme.colors.success);
    root.style.setProperty('--warning', theme.colors.warning);
    root.style.setProperty('--error', theme.colors.error);
    
    // Apply gradients
    root.style.setProperty('--gradient-primary', theme.gradients.primary);
    root.style.setProperty('--gradient-secondary', theme.gradients.secondary);
    root.style.setProperty('--gradient-accent', theme.gradients.accent);
    
    // Save to localStorage
    localStorage.setItem('life-quest-theme', currentThemeId);
  }, [currentThemeId]);
  
  const setTheme = (themeId: string) => {
    if (themes[themeId]) {
      setCurrentThemeId(themeId);
    }
  };
  
  const value: ThemeContextType = {
    currentTheme: themes[currentThemeId],
    setTheme,
    availableThemes: Object.values(themes)
  };
  
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};