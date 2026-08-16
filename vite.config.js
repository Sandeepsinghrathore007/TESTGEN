import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const base = process.env.VITE_BASE_PATH || (command === 'build' ? '/TESTGEN/' : '/')

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'LearnLedger',
          short_name: 'LearnLedger',
          description: 'Personal study workspace with notes, mock tests, PDFs, and AI help.',
          theme_color: '#12082b',
          background_color: '#070113',
          display: 'standalone',
          scope: base,
          start_url: base,
          orientation: 'portrait',
          icons: [
            {
              src: 'pwa-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'pwa-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,mjs,json}'],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        },
      }),
    ],
    resolve: {
      alias: {
        // '@/' maps to 'src/' — clean imports like: import Foo from '@/components/Foo'
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('pdfjs-dist')) return 'pdfjs'
            if (id.includes('@tiptap') || id.includes('/prosemirror-')) return 'editor-vendor'
            return undefined
          },
        },
      },
    },
  }
})
