import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:     '#ffffff',
        ink:    '#1a1a1a',
        muted:  '#6b6b6b',
        faint:  '#d4d4d4',
        border: '#e5e5e5',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'sans-serif'],
      },
      maxWidth: {
        page: '1200px',
        text: '640px',
      },
    },
  },
  plugins: [],
}

export default config
