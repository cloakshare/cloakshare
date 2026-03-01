import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#09090B',
        foreground: '#FAFAFA',
        card: { DEFAULT: '#111113', foreground: '#FAFAFA' },
        surface: '#111113',
        elevated: '#1A1A1D',
        muted: { DEFAULT: '#1A1A1D', foreground: '#A1A1AA' },
        hover: '#222225',
        accent: { DEFAULT: '#00FF88', foreground: '#09090B', hover: '#00DD77', muted: 'rgba(0, 255, 136, 0.15)' },
        success: '#00CC66',
        border: '#27272A',
        'border-subtle': '#1E1E21',
        input: '#0F0F11',
        ring: '#00FF88',
        destructive: { DEFAULT: '#FF4444', foreground: '#FAFAFA' },
        warning: '#FFAA00',
        info: '#00BBFF',
        'text-primary': '#FAFAFA',
        'text-secondary': '#A1A1AA',
        'text-tertiary': '#71717A',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'monospace'],
        sans: ['Geist Sans', 'General Sans', 'Satoshi', 'sans-serif'],
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '6px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
        md: '0 4px 12px rgba(0, 0, 0, 0.5)',
        lg: '0 8px 32px rgba(0, 0, 0, 0.6)',
        glow: '0 0 20px rgba(0, 255, 136, 0.1)',
      },
    },
  },
  plugins: [],
};

export default config;
