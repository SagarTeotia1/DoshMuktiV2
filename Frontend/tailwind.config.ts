import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
    './src/hooks/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    screens: {
      xs: '400px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        heading: ['var(--font-outfit)', 'Outfit', 'sans-serif'],
        body:    ['Satoshi', 'sans-serif'],
        mono:    ['source-code-pro', 'Menlo', 'Monaco', 'Consolas', 'Courier New', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input:  'hsl(var(--input))',
        ring:   'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        /* ── Brand shortcuts — bronze/copper "Temple Warmth" ── */
        brand: {
          gold:   '#9C5A26',   // bronze — kept key name for drop-in compat
          'gold-light': '#C9863F',
          'gold-dark':  '#6B3D19',
          bronze: '#9C5A26',
          'bronze-light': '#C9863F',
          'bronze-deep':  '#6B3D19',
          black:  '#2B1B0C',   // warm ink, replaces pure black
          paper:  '#FFFDF8',
          cream:  '#F6E4C2',
          bg:     '#EFE2C7',
          gray:   '#6B5539',
          muted:  '#8A7A63',
        },
      },
      borderRadius: {
        /* --radius is 0.9rem — soft, rounded "Temple Warmth" corners */
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 0.25rem)',
        sm: 'calc(var(--radius) - 0.4rem)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'marquee': {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(156, 90, 38, 0.35)' },
          '50%':      { boxShadow: '0 0 22px 12px rgba(156, 90, 38, 0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'fade-in-up':     'fade-in-up 0.7s ease-out both',
        'marquee':        'marquee 25s linear infinite',
        'float':          'float 3s ease-in-out infinite',
        'pulse-glow':     'pulse-glow 2s infinite',
      },
      boxShadow: {
        /* soft bronze-tinted glow shadows — replaces old hard-offset neo-brutalist set */
        'neo-sm':  '0 2px 8px rgba(107, 61, 25, 0.10)',
        'neo-md':  '0 6px 16px rgba(107, 61, 25, 0.12)',
        'neo-lg':  '0 10px 26px rgba(107, 61, 25, 0.14)',
        'neo-xl':  '0 16px 38px rgba(107, 61, 25, 0.16)',
        'neo-2xl': '0 22px 50px rgba(107, 61, 25, 0.18)',
        'neo-gold-sm': '0 4px 14px rgba(201, 134, 63, 0.30)',
        'neo-gold-md': '0 8px 22px rgba(201, 134, 63, 0.32)',
      },
    },
  },
  plugins: [animate],
};

export default config;
