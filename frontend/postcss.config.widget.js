/**
 * PostCSS Configuration for Widget Embed Bundle
 * 
 * Uses the widget-specific Tailwind config that scopes all utilities
 * inside .nr-widget-root to prevent conflicts with host site.
 */
export default {
  plugins: {
    tailwindcss: {
      config: './tailwind.config.widget.js',
    },
    autoprefixer: {},
  },
}
