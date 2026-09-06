/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        comic: {
          bg: '#121214',
          card: '#1a1a1e',
          border: '#2a2a32',
          primary: '#6366f1',
          primaryHover: '#4f46e5'
        }
      }
    },
  },
  plugins: [],
}
