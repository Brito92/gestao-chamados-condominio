/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta funcional inspirada em sinalização de manutenção/obra:
        // azul-ardósia (confiança/estrutura) + âmbar (atenção/trabalho em curso).
        ardosia: {
          50: '#f2f5f7',
          100: '#e1e8ec',
          200: '#c3d1d9',
          300: '#9bb0bd',
          400: '#6c8998',
          500: '#4d6b7a',
          600: '#3a5563',
          700: '#2f4450',
          800: '#293a44',
          900: '#24313a',
          950: '#151d23',
        },
        ambar: {
          50: '#fff9ec',
          100: '#ffefc8',
          200: '#ffdb8c',
          300: '#ffc04d',
          400: '#ffa41f',
          500: '#f98307',
          600: '#dd6103',
          700: '#b74407',
          800: '#94350c',
          900: '#7a2d0e',
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
