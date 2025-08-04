// Simplified PostCSS config without TailwindCSS to bypass styling issues
export default {
  plugins: [
    // Temporarily remove TailwindCSS to fix build
    // 'tailwindcss',
    'autoprefixer',
  ],
};