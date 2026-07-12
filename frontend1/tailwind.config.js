/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Core neutral scale — clean cool slate used for surfaces, text, borders.
        // Tuned for an airy, professional LIGHT-first interface.
        ink: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          850: '#172033',
          900: '#0F172A',
          950: '#0A101F',
        },
        // Primary accent — modern indigo/violet (replaces old amber "signal")
        signal: {
          50: '#F1F0FF',
          100: '#E4E1FE',
          200: '#CDC7FE',
          300: '#AB9FFD',
          400: '#8B79F9',
          500: '#7458F0',
          600: '#6339E0',
          700: '#5429C4',
          800: '#4623A0',
          900: '#391E7F',
        },
        // Secondary accent — vivid teal (replaces old cyan "signal2")
        signal2: {
          50: '#ECFEFF',
          100: '#CFFAFE',
          200: '#A2F0FA',
          300: '#5CDCED',
          400: '#22C7DE',
          500: '#0EACC4',
          600: '#0A8AA0',
          700: '#0C6E80',
          800: '#0F5868',
          900: '#114857',
        },
        // `primary` mirrors signal (indigo) so any leftover legacy classes resolve sensibly
        primary: {
          50: '#F1F0FF',
          100: '#E4E1FE',
          200: '#CDC7FE',
          300: '#AB9FFD',
          400: '#8B79F9',
          500: '#7458F0',
          600: '#6339E0',
          700: '#5429C4',
          800: '#4623A0',
          900: '#391E7F',
        },
        navy: { DEFAULT: '#0F172A', dark: '#0A101F' },
      },
      fontFamily: {
        sans: ['"Noto Sans Devanagari"', 'Mangal', '"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Noto Sans Devanagari"', '"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        hindi: ['Mangal', '"Noto Sans Devanagari"', 'sans-serif'],
      },
      boxShadow: {
        'glow-signal': '0 1px 2px rgba(99,57,224,0.06), 0 8px 24px -8px rgba(99,57,224,0.35)',
        'glow-cyan': '0 1px 2px rgba(14,172,196,0.06), 0 8px 24px -8px rgba(14,172,196,0.30)',
        soft: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -12px rgba(15,23,42,0.10)',
        card: '0 1px 1px rgba(15,23,42,0.02), 0 2px 8px -2px rgba(15,23,42,0.06), 0 12px 32px -16px rgba(15,23,42,0.10)',
        panel: '0 1px 0 0 rgba(255,255,255,0.5) inset, 0 20px 40px -20px rgba(15,23,42,0.18)',
        lift: '0 20px 40px -12px rgba(99,57,224,0.20)',
      },
      backgroundImage: {
        'grid-faint': 'linear-gradient(rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.05) 1px, transparent 1px)',
        'grid-faint-dark': 'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
        aurora: 'radial-gradient(60% 60% at 20% 20%, rgba(116,88,240,0.20), transparent 60%), radial-gradient(50% 50% at 85% 15%, rgba(14,172,196,0.16), transparent 60%), radial-gradient(60% 60% at 50% 100%, rgba(116,88,240,0.10), transparent 60%)',
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
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        scanline: 'scanline 3s linear infinite',
        pulseDot: 'pulseDot 1.8s ease-in-out infinite',
        fadeUp: 'fadeUp 0.35s ease-out both',
        shimmer: 'shimmer 2.5s linear infinite',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
