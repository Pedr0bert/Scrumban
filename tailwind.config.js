/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./js/**/*.js"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        offwhite: '#FAF8F5',
        beige: '#E8E3D9',
        terracota: '#BD6B58',
        musgo: '#94A086',
        dark: '#2D2B2A',
        media: '#D4A373'
      },
      fontFamily: {
        serif: ['"Crimson Pro"', 'serif'],
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    }
  },
  safelist: [
    'dark',
    'bg-musgo/20',
    'text-musgo',
    'bg-media/20',
    'text-media',
    'bg-terracota/20',
    'text-terracota',
    'bg-red-50/20',
    'bg-red-100/40',
    'border-terracota',
    'column-wip-exceeded',
    'collapsed'
  ],
  plugins: []
};
