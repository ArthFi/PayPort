import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bg-primary':   '#0a0e17',
        'bg-card':      '#111827',
        'bg-card-alt':  '#1a2332',
        'bg-hover':     '#1e293b',
        'hsk-blue':     '#1A56FF',
        'border-dim':   '#1f2937',
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
