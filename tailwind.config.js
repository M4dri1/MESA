/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mesa: {
          bg: '#0b0f19',
          surface: '#121826',
          card: '#161e31',
          cardBorder: '#232d46',
          sidebar: '#080c14',
          yellow: '#fbc02d',
          yellowHover: '#f5b014',
          yellowDark: '#d99b00',
          blue: '#3b82f6',
          blueDark: '#2563eb',
          purple: '#8b5cf6',
          pink: '#ec4899',
          green: '#10b981',
          textMuted: '#94a3b8',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
