/**
 * Tailwind CSS Configuration for Widget Embed Bundle
 * 
 * Key difference from main config:
 * - `important: '.nr-widget-root'` scopes ALL Tailwind utilities inside the widget container
 *   This prevents style conflicts with the host site (WordPress, etc.)
 * - Content paths limited to widget-related components only
 * 
 * @type {import('tailwindcss').Config}
 */
export default {
  // Scope ALL utilities inside .nr-widget-root to prevent host page conflicts
  important: '.nr-widget-root',
  
  // Only scan widget-related files for class usage
  content: [
    "./src/components/widget/**/*.{js,ts,jsx,tsx}",
    "./src/components/widget-embed/**/*.{js,ts,jsx,tsx}",
    "./src/hooks/useIntakeForm.ts",
  ],
  
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        secondary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'spin': 'spin 1s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  
  // Disable Tailwind's Preflight (base reset) to avoid conflicts with host page
  corePlugins: {
    preflight: false,
  },
  
  plugins: [],
}
