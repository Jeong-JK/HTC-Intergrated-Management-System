import colors from 'tailwindcss/colors.js'

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
        // 단색으로 덮으면 red-50~900 클래스가 전부 사라짐 → 팔레트 유지 + text-red 등은 DEFAULT
        red:     { ...colors.red, DEFAULT: '#ef4444' },
        yellow:  '#f59e0b',
        text:    '#1e293b',
        dim:     '#64748b',
      }
    }
  },
  plugins: []
}
