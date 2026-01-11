/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FFD700', // Gold
          foreground: '#000000', // Black text on gold
        },
        secondary: {
          DEFAULT: '#1a1a1a', // Dark Gray/Black for contrast
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#C0C0C0', // Silver as accent? Or maybe keeping a darker gold variant
          foreground: '#000000',
        },
        // Adding a rich black/dark gray for backgrounds to make the gold pop
        dark: {
          DEFAULT: '#0f0f0f',
          lighter: '#1f1f1f'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Assuming Inter or similar, can be updated if fonts are needed
        serif: ['Playfair Display', 'serif'], // Good for luxury feel
      },
    },
  },
  plugins: [],
}
