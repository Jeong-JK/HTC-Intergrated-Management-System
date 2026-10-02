/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  safelist: [
    'bg-red-300',
    'bg-orange-300',
    'bg-yellow-300',
    'text-red-900',
    'text-orange-900',
    'text-yellow-900',
    'bg-red-600',
    'bg-red-700',
    'hover:bg-red-700',
    'text-red-600',
    'bg-blue-600',
    'bg-blue-700',
    'hover:bg-blue-700',
  ],
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
        danger:  '#ef4444',
        yellow:  '#f59e0b',
        text:    '#1e293b',
        dim:     '#64748b',
      }
    }
  },
  plugins: []
}
