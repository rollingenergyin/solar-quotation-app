import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        solar: {
          50:  '#eef3fb',
          100: '#d5e3f5',
          200: '#adc5eb',
          300: '#85a8e0',
          400: '#6690cc',
          500: '#4e78ba',
          600: '#3c5e94',
          700: '#2c4570',
          800: '#1e2f4d',
          900: '#161c34',
          950: '#0d1020',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'solar-gradient':   'linear-gradient(135deg, #161c34 0%, #1e2f4d 40%, #2c4570 70%, #3c5e94 100%)',
        'solar-gradient-h': 'linear-gradient(90deg, #161c34 0%, #6690cc 100%)',
        'solar-light':      'linear-gradient(135deg, #eef3fb 0%, #ffffff 100%)',
      },
      boxShadow: {
        page: '0 4px 24px rgba(22,28,52,0.10)',
      },
      screens: {
        print: { raw: 'print' },
      },
    },
  },
  plugins: [],
};

export default config;
