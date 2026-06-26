/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Core "command console" ink scale — used for the app shell, sidebar, panels
        ink: {
          50: '#F4F6FA',
          100: '#DCE1EB',
          200: '#AEB8CC',
          300: '#7C8AA3',
          400: '#54637F',
          500: '#34415C',
          600: '#243049',
          700: '#1A2438',
          800: '#121A2B',
          850: '#0F172A',
          900: '#0B1220',
          950: '#070B14',
        },
        // Primary accent — signal amber (alerts, primary actions, priority)
        signal: {
          50: '#FFF8EB',
          100: '#FFEDC2',
          200: '#FFDD8A',
          300: '#FDC94D',
          400: '#F8B324',
          500: '#F0A012',
          600: '#D6840A',
          700: '#B0660B',
          800: '#8F5210',
          900: '#754411',
        },
        // Secondary accent — tactical cyan (info, active/live states, links)
        signal2: {
          50: '#ECFEFF',
          100: '#CFFAFE',
          200: '#A2F0FA',
          300: '#67E1F2',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
          700: '#0E7490',
          800: '#155E75',
          900: '#164E63',
        },
        // Keep `primary` mapped to signal2 so any leftover legacy classes still resolve sensibly
        primary: {
          50: '#ECFEFF',
          100: '#CFFAFE',
          200: '#A2F0FA',
          300: '#67E1F2',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
          700: '#0E7490',
          800: '#155E75',
          900: '#164E63',
        },
        navy: { DEFAULT: '#0F172A', dark: '#070B14' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-signal': '0 0 0 1px rgba(240,160,18,0.25), 0 8px 24px -8px rgba(240,160,18,0.35)',
        'glow-cyan': '0 0 0 1px rgba(34,211,238,0.25), 0 8px 24px -8px rgba(34,211,238,0.35)',
        panel: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 32px -16px rgba(0,0,0,0.45)',
      },
      backgroundImage: {
        'grid-faint': 'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.5, transform: 'scale(0.85)' },
        },
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        scanline: 'scanline 3s linear infinite',
        pulseDot: 'pulseDot 1.8s ease-in-out infinite',
        fadeUp: 'fadeUp 0.35s ease-out both',
      },
    },
  },
  plugins: [],
};