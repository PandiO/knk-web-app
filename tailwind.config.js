/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb',
          light: '#3b82f6',
          // Hover/pressed shade of the primary buttons and links (#38; tokens follow in #95).
          dark: '#1d4ed8',
        },
        secondary: '#64748b',
        accent: '#0f172a',
        surface: {
          DEFAULT: '#ffffff',
          hover: '#f8fafc',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};