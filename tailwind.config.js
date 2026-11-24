/** @type {import('tailwindcss').Config} */
// TaxShoe "matte ledger" design system. Tokens live as CSS variables in
// src/index.css; this file only maps them to utility names.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Archivo', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        void:    'rgb(var(--void) / <alpha-value>)',     // page
        matte:   'rgb(var(--matte) / <alpha-value>)',    // panels
        raised:  'rgb(var(--raised) / <alpha-value>)',   // modals, menus
        ink:     'rgb(var(--ink) / <alpha-value>)',
        muted:   'rgb(var(--muted) / <alpha-value>)',
        faint:   'rgb(var(--faint) / <alpha-value>)',
        signal:  'rgb(var(--signal) / <alpha-value>)',   // the one accent: live / hovered / selected
        income:  'rgb(var(--income) / <alpha-value>)',
        expense: 'rgb(var(--expense) / <alpha-value>)',
        deduct:  'rgb(var(--deduct) / <alpha-value>)',
        doc:     'rgb(var(--doc) / <alpha-value>)',
        pending: 'rgb(var(--pending) / <alpha-value>)',
      },
      borderColor: {
        line: 'rgb(var(--ink) / 0.09)',
        'line-strong': 'rgb(var(--ink) / 0.16)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)', // ease-out-expo
      },
      zIndex: {
        field: '0', content: '10', sticky: '30', menu: '40', modal: '50', toast: '60',
      },
    },
  },
  plugins: [],
}
