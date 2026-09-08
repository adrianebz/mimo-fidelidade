/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'mimo-graphite': '#0F0F10',
        'mimo-offwhite': '#F7F5EF',
        'mimo-yellow': '#FFC82C',
        'mimo-green': '#16A34A',
        'mimo-gray': '#8ABABF',
        'mimo-orange': '#FF9F0A',
        'mimo-red': '#FF453A',
        'base': '#0F0F10',
        'elevated': '#16161A',
        'card': '#1F1F24'
      },
      fontFamily: {
        sans: ['Montserrat', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
