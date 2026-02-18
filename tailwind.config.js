/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          lotus: '#9E9590',
          mocha: '#7A6E5F',
          silver: '#5C5B50',
          blush: '#C9A5A0',
          camel: '#C9AC84',
          amber: '#D4A853',
          oak: '#6B5D55',
        },
        surface: {
          page: '#F5F0EB',
          card: '#FFFFFF',
          section: '#EDE6DF',
          input: '#FAF8F6',
          filled: '#E8F5E9',
        },
        status: {
          success: '#4CAF50',
          warning: '#FB8C00',
          danger: '#E53935',
          info: '#42A5F5',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', '"PingFang TC"', '"Microsoft JhengHei"', 'sans-serif'],
        num: ['"SF Pro Display"', 'Roboto', '"Noto Sans TC"', 'sans-serif'],
      },
      borderRadius: {
        btn: '12px',
        card: '16px',
        input: '10px',
        sheet: '20px',
        tag: '8px',
      },
    },
  },
  plugins: [],
}
