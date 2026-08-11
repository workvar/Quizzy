/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#F26207',
          'orange-soft': '#FF8A4C',
          'orange-deep': '#E24A0F',
          ink: '#191B1F',
          'ink-2': '#5C6370',
          'ink-3': '#8B93A1',
          surface: '#F4F5F7',
          card: '#FFFFFF',
          line: '#E6E8EC',
          mist: '#FFF4EC',
        },
        apple: {
          // Remapped primary toward Replit-inspired orange for cohesive branding
          blue: '#F26207',
          green: '#22C55E',
          red: '#EF4444',
          orange: '#F26207',
          yellow: '#F59E0B',
          purple: '#7C3AED',
          gray: '#F4F5F7',
          'gray-2': '#E6E8EC',
          'gray-3': '#D5D8DE',
          'gray-4': '#C4C9D1',
          'gray-5': '#A0A7B4',
          'gray-6': '#8B93A1',
          text: '#191B1F',
          'text-2': '#5C6370',
          'text-3': '#8B93A1',
        },
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-body)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'apple-sm': '0 1px 2px rgba(25,27,31,0.05), 0 1px 1px rgba(25,27,31,0.03)',
        apple: '0 2px 8px rgba(25,27,31,0.06), 0 1px 2px rgba(25,27,31,0.04)',
        'apple-md': '0 8px 24px rgba(25,27,31,0.08), 0 2px 6px rgba(25,27,31,0.04)',
        'apple-lg': '0 16px 40px rgba(25,27,31,0.10), 0 4px 12px rgba(25,27,31,0.05)',
        brand: '0 10px 40px rgba(242,98,7,0.18)',
      },
      borderRadius: {
        apple: '10px',
        'apple-md': '12px',
        'apple-lg': '16px',
        'apple-xl': '20px',
      },
      backgroundImage: {
        'brand-mesh':
          'radial-gradient(1200px 600px at 10% -10%, rgba(255,138,76,0.28), transparent 55%), radial-gradient(900px 500px at 90% 10%, rgba(242,98,7,0.16), transparent 50%), radial-gradient(700px 400px at 50% 100%, rgba(255,196,150,0.22), transparent 55%), linear-gradient(180deg, #FFF8F3 0%, #F4F5F7 55%, #EEF0F4 100%)',
      },
      keyframes: {
        brandFloat: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        brandFadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'brand-float': 'brandFloat 5s ease-in-out infinite',
        'brand-fade-up': 'brandFadeUp 0.55s ease both',
      },
    },
  },
  plugins: [],
};
