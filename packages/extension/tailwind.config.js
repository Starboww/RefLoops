import path from 'path';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.resolve(__dirname, './index.html'),
    path.resolve(__dirname, './src/**/*.{js,ts,jsx,tsx,html}'),
    path.resolve(__dirname, '../ui/src/**/*.{js,ts,jsx,tsx}'),
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        refloop: {
          base: '#1B1F24',
          surface: '#1F2228',
          elevated: '#292E35',
          subtle: '#3E424C',
          muted: '#5F646D',
          subtext: '#C1C6CD',
          head: '#DFE4FC',
          brand: '#FF3C6B',
          'brand-dark': '#FF2458',
          cosmic: '#4250CC',
          mint: '#0BDFC5',
          green: '#0DC562',
          yellow: '#DFE686',
          red: '#DD2C61',
          purple: '#AA86F5',
        },
        // Keep claude colors for non-breaking backward compatibility
        claude: {
          bg: '#1B1F24',
          surface: '#1F2228',
          'surface-hover': '#292E35',
          border: 'rgba(255, 255, 255, 0.12)',
          'border-subtle': 'rgba(255, 255, 255, 0.08)',
          terracotta: '#FF3C6B',
          'terracotta-hover': '#FF2458',
          'terracotta-subtle': 'rgba(255, 60, 107, 0.15)',
          sand: '#292E35',
          charcoal: '#FFFFFF',
          muted: '#C1C6CD',
        },
      },
      fontFamily: {
        heading: ['"Tosh B"', 'sans-serif'],
        body: ['"Aeonik Fono"', 'monospace', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'serif'],
        mono: ['"JetBrains Mono"', '"Aeonik Fono"', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0px 1px 8px 0px rgba(0, 0, 0, 0.15)',
        insetGlow: '0px -4px 11px 0px rgba(255, 255, 255, 0.12) inset',
        insetSubtle: '0px -4px 11px 0px rgba(255, 255, 255, 0.07) inset',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
