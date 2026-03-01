/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        background: '#09090B',
        surface: '#111113',
        elevated: '#1A1A1D',
        hover: '#222225',
        input: '#0F0F11',
        border: {
          DEFAULT: '#27272A',
          subtle: '#1E1E21',
        },
        foreground: '#FAFAFA',
        'text-primary': '#FAFAFA',
        'text-secondary': '#A1A1AA',
        'text-tertiary': '#71717A',
        accent: {
          DEFAULT: '#00FF88',
          hover: '#00DD77',
          muted: 'rgba(0, 255, 136, 0.15)',
        },
        destructive: '#FF4444',
        warning: '#FFAA00',
        success: '#00CC66',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'monospace'],
        sans: ['Geist Sans', 'General Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(0, 255, 136, 0.1)',
        'glow-lg': '0 0 40px rgba(0, 255, 136, 0.15)',
      },
    },
  },
  plugins: [],
};
