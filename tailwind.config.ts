import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // page backgrounds
        charcoal: '#161615',    // dark pages: homepage, blog post, password prompt
        'warm-white': '#faf9f6', // light pages: blog listing, gallery, tools

        // nav
        'nav-bg': '#111110',
        'border-dark': '#2c2c2a',
        'border-light': '#e4e3de',

        // text on dark
        'text-primary': '#eceae4',
        'text-secondary': '#8a8a82',
        'text-muted': '#4a4a45',

        // text on light
        'light-primary': '#1a1a18',
        'light-secondary': '#7a7a72',
        'light-muted': '#b0afa8',

        // accent — used sparingly
        accent: '#00BAAD',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'sans-serif'],
      },
      maxWidth: {
        blog: '660px',   // blog listing, tools directory
        post: '620px',   // individual blog posts
      },
      height: {
        nav: '52px',
      },
    },
  },
  plugins: [],
}

export default config
