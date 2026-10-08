/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'boomii-graphite': '#0F0F10',
        'boomii-offwhite': '#F7F5EF',
        'boomii-yellow': '#FFC82C',
        'boomii-green': '#16A34A',
        'boomii-gray': '#8ABABF',
        'boomii-orange': '#FF9F0A',
        'boomii-red': '#FF453A',
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
