import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['var(--font-outfit)', 'Outfit', 'sans-serif'],
        body: ['Satoshi', 'sans-serif'],
      },
      colors: {
        // Single brand accent kept consistent with the storefront — everything
        // else is neutral slate, tuned for dense data tables, not "Temple Warmth".
        brand: {
          gold: '#9C5A26',
          'gold-light': '#C9863F',
          'gold-dark': '#6B3D19',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
