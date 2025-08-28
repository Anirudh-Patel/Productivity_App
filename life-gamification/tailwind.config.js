/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Manhwa-inspired color palette
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
        // Solo Leveling theme
        solo: {
          bg: '#0A0E1A',
          primary: '#1E2A3A',
          accent: '#00D4FF',
          secondary: '#6366F1',
          text: '#E5E7EB',
          warning: '#EF4444',
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