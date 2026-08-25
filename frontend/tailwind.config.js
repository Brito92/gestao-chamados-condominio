/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta funcional inspirada em sinalização de manutenção/obra:
        // azul-ardósia (confiança/estrutura) + âmbar (atenção/trabalho em curso).
        ardosia: {
          50: '#111111',
          100: '#191919',
          200: '#292929',
          300: '#414141',
          400: '#777777',
          500: '#a3a3a3',
          600: '#c4c4c4',
          700: '#dedede',
          800: '#f0f0f0',
          900: '#fafafa',
          950: '#111111',
        },
        ambar: {
          50: '#2a2415',
          100: '#3b3018',
          200: '#6b521f',
          300: '#c2932e',
          400: '#e8bd54',
          500: '#dcae3d',
          600: '#bd8f22',
          700: '#977019',
          800: '#705315',
          900: '#4a370e',
        },
      },
      fontFamily: {
        display: ['"Manrope"', 'sans-serif'],
        sans: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(21 29 35 / 0.06), 0 1px 3px 0 rgb(21 29 35 / 0.08)',
      },
      screens: {
        'xs': '375px',
      },
    },
  },
  plugins: [],
};
