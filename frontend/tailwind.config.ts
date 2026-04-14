import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          base: '#080C14',
          card: '#0E1420',
          raised: '#141B28',
          border: '#1C2535',
          hover: '#1A2234',
        },
        brand: {
          DEFAULT: '#5B8EFF',
          dim: '#2D4A99',
          glow: 'rgba(91,142,255,0.12)',
        },
        success: '#34D399',
        warning: '#FBBF24',
        danger: '#F87171',
        neutral: '#6B7280',
        ink: {
          primary: '#E8EDF5',
          secondary: '#8896A8',
          muted: '#4D5A6B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
