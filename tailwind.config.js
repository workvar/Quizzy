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
          // WorkVar forest green (aliases keep orange-* class names working)
          orange: '#1A5D38',
          'orange-soft': '#56D685',
          'orange-deep': '#164C30',
          ink: '#1C1917',
          'ink-2': '#57534E',
          'ink-3': '#78716C',
          surface: '#FAFAF9',
          card: '#FFFFFF',
          line: '#D6D3D1',
          mist: '#F2FDF4',
        },
        apple: {
          // Remapped primary toward WorkVar forest green
          blue: '#1A5D38',
          green: '#20914D',
          red: '#EF4444',
          orange: '#1A5D38',
          yellow: '#F59E0B',
          purple: '#7C3AED',
          gray: '#F5F5F4',
          'gray-2': '#E7E5E4',
          'gray-3': '#D6D3D1',
          'gray-4': '#A8A29E',
          'gray-5': '#78716C',
          'gray-6': '#57534E',
          text: '#1C1917',
          'text-2': '#57534E',
          'text-3': '#78716C',
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
        brand: '0 10px 40px rgba(26,93,56,0.18)',
      },
      borderRadius: {
        apple: '10px',
        'apple-md': '12px',
        'apple-lg': '16px',
        'apple-xl': '20px',
      },
      backgroundImage: {
        'brand-mesh':
          'radial-gradient(1200px 600px at 10% -10%, rgba(225,251,230,0.9), transparent 55%), radial-gradient(900px 500px at 90% 10%, rgba(195,245,205,0.45), transparent 50%), radial-gradient(700px 400px at 50% 100%, rgba(242,253,244,0.8), transparent 55%), linear-gradient(180deg, #F2FDF4 0%, #FAFAF9 55%, #F5F5F4 100%)',
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
