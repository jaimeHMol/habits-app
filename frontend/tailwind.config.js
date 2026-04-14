/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paramo: {
          bg: '#1c1917',      // stone-900: Fondo principal oscuro
          board: '#292524',   // stone-800: Fondo de las columnas
          card: '#44403c',    // stone-700: Fondo de las tarjetas
          text: '#e7e5e4',    // stone-200: Texto principal
          muted: '#a8a29e',   // stone-400: Texto secundario / Prioridad Opcional
          frailejon: '#0d9488', // teal-600: Prioridad Importante
          tierra: '#b45309',  // amber-700: Prioridad Crítica
        }
      }
    },
  },
  plugins: [],
}