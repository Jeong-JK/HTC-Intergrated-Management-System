/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        bg:      '#f1f5f9',
        panel:   '#ffffff',
        card:    '#f8fafc',
        border:  '#e2e8f0',
        accent:  '#3b82f6',
        accent2: '#f59e0b',
        red:     '#ef4444',
        text:    '#1e293b',
        dim:     '#64748b',
      }
    }
  },
  plugins: []
}
