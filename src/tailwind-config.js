/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Now you can use font-poppins, font-league, or font-glacial in your classes
        poppins: ['Poppins', 'sans-serif'],
        league: ['"League Spartan"', 'sans-serif'],
        glacial: ['"Glacial Indifference"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}