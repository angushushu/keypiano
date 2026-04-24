import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,png}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(gleitz\.github\.io|tonejs\.github\.io|raw\.githubusercontent\.com)\/.*\.mp3$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio-samples-cache',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      manifest: {
        name: 'KeyPiano',
        short_name: 'KeyPiano',
        description: 'Turn your Computer Keyboard into a professional Piano',
        theme_color: '#18181b',
        background_color: '#18181b',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
  // CRITICAL: This ensures assets load correctly when hosted in a subfolder
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})