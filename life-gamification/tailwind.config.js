/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dynamic theme colors using CSS variables
        'theme-bg': 'rgb(var(--background) / <alpha-value>)',
        'theme-fg': 'rgb(var(--foreground) / <alpha-value>)',
        'theme-primary': 'rgb(var(--primary) / <alpha-value>)',
        'theme-secondary': 'rgb(var(--secondary) / <alpha-value>)',
        'theme-accent': 'rgb(var(--accent) / <alpha-value>)',
        'theme-muted': 'rgb(var(--muted) / <alpha-value>)',
        'theme-success': 'rgb(var(--success) / <alpha-value>)',
        'theme-warning': 'rgb(var(--warning) / <alpha-value>)',
        'theme-error': 'rgb(var(--error) / <alpha-value>)',
        
        // Keep original colors for backward compatibility
        primary: {
          red: '#FF6B6B',
          teal: '#4ECDC4',
          yellow: '#FFE066',
        },
        rarity: {
          common: '#FFFFFF',
          uncommon: '#1EFF00',
          rare: '#0070DD',
          epic: '#A335EE',
          legendary: '#FF8000',
        },
        // Solo Leveling theme (fallback)
        solo: {
          bg: 'rgb(var(--background) / <alpha-value>)',
          primary: 'rgb(var(--primary) / <alpha-value>)',
          accent: 'rgb(var(--accent) / <alpha-value>)',
          secondary: 'rgb(var(--secondary) / <alpha-value>)',
          text: 'rgb(var(--foreground) / <alpha-value>)',
          warning: 'rgb(var(--error) / <alpha-value>)',
        },
      },
      animation: {
        'level-up': 'levelUp 1s ease-out',
        'xp-gain': 'xpGain 1.5s ease-out',
        'combo': 'combo 0.5s ease-in-out',
      },
      keyframes: {
        levelUp: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.5)', opacity: '0.8' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        xpGain: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-50px)', opacity: '0' },
        },
        combo: {
          '0%': { transform: 'scale(1) rotate(0deg)' },
          '50%': { transform: 'scale(1.2) rotate(5deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)' },
        },
      },
    },
  },
  plugins: [],
}