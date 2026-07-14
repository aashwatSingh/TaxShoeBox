/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        // Single accent scale — used sparingly (primary actions, key
        // figures, active states), never as decoration.
        gold: {
          300: '#fcd34d',
          400: '#f0b429',
          500: '#d99a1f',
          600: '#b17d16',
          700: '#8a6112',
        },
      },
      // Snappier default ease for micro-interactions.
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
