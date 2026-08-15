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
        claude: {
          bg: '#FAF8F5',
          surface: '#FFFFFF',
          'surface-hover': '#F4F0EA',
          border: '#E8E3DA',
          'border-subtle': '#F0ECE3',
          terracotta: '#D97757',
          'terracotta-hover': '#C86545',
          'terracotta-subtle': '#FDF4F0',
          sand: '#F3EFEA',
          charcoal: '#1C1917',
          muted: '#78716C',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
