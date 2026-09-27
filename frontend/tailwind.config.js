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
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.05), 0 1px 3px 0 rgb(15 23 42 / 0.08)',
        'card-hover': '0 4px 12px -2px rgb(15 23 42 / 0.1), 0 2px 6px -2px rgb(15 23 42 / 0.08)',
        glow: '0 0 0 1px rgb(14 165 233 / 0.25), 0 4px 16px -2px rgb(14 165 233 / 0.4)',
        console: '0 0 0 1px rgb(148 163 184 / 0.12), 0 8px 32px -8px rgb(2 6 23 / 0.8), inset 0 1px 0 0 rgb(255 255 255 / 0.04)',
        'console-light': '0 0 0 1px rgb(15 23 42 / 0.06), 0 12px 32px -12px rgb(15 23 42 / 0.18)',
        'glow-critical': '0 0 16px -2px rgb(239 68 68 / 0.5)',
        'glow-high': '0 0 16px -2px rgb(249 115 22 / 0.5)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.21, 1.02, 0.73, 1)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink-soft': 'blinkSoft 2.4s ease-in-out infinite',
        'scan': 'scan 7s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        blinkSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        scan: {
          '0%': { top: '-10%' },
          '100%': { top: '110%' },
        },
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}