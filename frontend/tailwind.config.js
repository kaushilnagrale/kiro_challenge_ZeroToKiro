/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#111317',
        surface: '#1a1d23',
        border: '#2a2d35',
        orange: '#ffb693',
        'orange-dim': '#cc8a6a',
        green: '#4ade80',
        yellow: '#facc15',
        red: '#f87171',
        blue: '#60a5fa',
        heat: '#f97316',
        advisory: '#a78bfa',
      },
      fontFamily: {
        sans: ['Lexend', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
