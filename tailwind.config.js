/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        glass: "rgba(255, 255, 255, 0.7)",
        glassBorder: "rgba(255, 255, 255, 0.5)",
        'mini-red': 'var(--mini-primary)', 
        'mini-black': '#111111',
        'mini-green': '#003323',
      }
    },
  },
  plugins: [],
}