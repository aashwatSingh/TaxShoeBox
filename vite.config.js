import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SECURITY_HEADERS = {
  // Prevent the page being framed by another origin (clickjacking)
  'X-Frame-Options': 'DENY',
  // Stop browsers guessing content types (MIME-sniffing attacks)
  'X-Content-Type-Options': 'nosniff',
  // Restrict referrer info sent to external sites
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Disable browser features not needed by this app
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // Strict Content Security Policy:
  //   - default: only same origin
  //   - scripts: same origin + Vite dev HMR blob URLs
  //   - styles: same origin + inline (Tailwind injects inline styles)
  //   - fonts: Google Fonts
  //   - connect: same origin + Supabase API
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' blob:",      // 'unsafe-inline' needed for Vite HMR in dev
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
  ].join('; '),
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@config': path.resolve(__dirname, './config'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    headers: SECURITY_HEADERS,
  },
  preview: {
    headers: SECURITY_HEADERS,
  },
  build: {
    // Split large dependencies into separate, independently-cacheable
    // chunks. The vendor code rarely changes, so returning users only
    // re-download the small app chunk after an update.
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor':    ['react', 'react-dom', 'react-router-dom'],
          'animation-vendor': ['framer-motion'],
          'supabase-vendor': ['@supabase/supabase-js'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
