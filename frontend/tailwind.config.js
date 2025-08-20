/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Roboto Mono', 'monospace'],
      },
      keyframes: {
        reveal: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulse_green: {
            '0%, 100%': { boxShadow: '0 0 0 0 rgba(74, 222, 128, 0.7)' },
            '50%': { boxShadow: '0 0 0 8px rgba(74, 222, 128, 0)' },
        },
        pulse_red: {
            '0%, 100%': { boxShadow: '0 0 0 0 rgba(248, 113, 113, 0.7)' },
            '50%': { boxShadow: '0 0 0 8px rgba(248, 113, 113, 0)' },
        },
      },
      animation: {
        reveal: 'reveal 0.5s ease-out forwards',
        pulse_green: 'pulse_green 1.5s ease-in-out',
        pulse_red: 'pulse_red 1.5s ease-in-out',
      }
    },
  },
  plugins: [],
}
