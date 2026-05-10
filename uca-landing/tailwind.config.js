export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        card: '#111111',
        'card-hover': '#161616',
        accent: '#00d4ff',
        purple: '#a855f7',
        green: '#22c55e',
        yellow: '#eab308',
        border: 'rgba(255,255,255,0.07)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(28px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        drift: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(40px, -30px) scale(1.08)' },
          '66%': { transform: 'translate(-30px, 20px) scale(0.92)' },
        },
        pulseGlow: {
          '0%, 100%': {
            boxShadow: '0 0 0 0 rgba(0, 212, 255, 0)',
            borderColor: 'rgba(255, 255, 255, 0.07)',
          },
          '50%': {
            boxShadow: '0 0 56px -8px rgba(0, 212, 255, 0.45)',
            borderColor: 'rgba(0, 212, 255, 0.35)',
          },
        },
        barGrow: {
          '0%': { transform: 'scaleY(0.6)', opacity: '0.6' },
          '100%': { transform: 'scaleY(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'fade-in': 'fadeIn 0.45s ease-out forwards',
        'scale-in': 'scaleIn 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'float-slow': 'float 6s ease-in-out infinite',
        drift: 'drift 22s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'bar-grow': 'barGrow 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards',
      },
    },
  },
  plugins: [],
}
