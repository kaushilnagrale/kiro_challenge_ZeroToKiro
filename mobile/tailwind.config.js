/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        "pulse-blue":   "#0ea5e9",
        "pulse-green":  "#22c55e",
        "pulse-yellow": "#eab308",
        "pulse-red":    "#ef4444",
        "pulse-orange": "#f97316",
        "pulse-purple": "#a855f7",
      },
    },
  },
  plugins: [],
};
