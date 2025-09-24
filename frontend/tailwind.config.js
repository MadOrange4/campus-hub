/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        /* brand colors (alpha-aware) */
        brand:        'rgb(var(--brand) / <alpha-value>)',
        'brand-600':  'rgb(var(--brand-600) / <alpha-value>)',
        'brand-700':  'rgb(var(--brand-700) / <alpha-value>)',

        /* accent & status */
        accent:       'rgb(var(--accent) / <alpha-value>)',
        success:      'rgb(var(--success) / <alpha-value>)',
        info:         'rgb(var(--info) / <alpha-value>)',
        warning:      'rgb(var(--warning) / <alpha-value>)',
        danger:       'rgb(var(--danger) / <alpha-value>)',

        /* semantic surfaces & text */
        surface:      'rgb(var(--surface) / <alpha-value>)',
        background:   'rgb(var(--background) / <alpha-value>)',
        muted:        'rgb(var(--muted) / <alpha-value>)',
        border:       'rgb(var(--border) / <alpha-value>)',
        text:         'rgb(var(--text) / <alpha-value>)',
        'text-muted': 'rgb(var(--text-muted) / <alpha-value>)',
      },
      boxShadow: { soft: '0 8px 24px rgba(0,0,0,0.08)' },
      borderRadius: { '2xl': '1rem' },
    },
  },
  plugins: [],
}
