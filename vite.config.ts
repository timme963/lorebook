/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';


export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
    manifest: {
      name: 'Lorebook',
      short_name: 'Lorebook',
      description: 'Lernen mit Story, Vorabfragen und Spaced Repetition',
      lang: 'de',
      theme_color: '#1f1b2e',
      background_color: '#faf8f4',
      display: 'standalone',
      start_url: '/',
      id: '/',
      icons: [
        { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,mjs,png,ico}'],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      // APK-Download und Versionsdatei nie durch die App-Hülle ersetzen
      navigateFallbackDenylist: [/\.apk$/, /version\.json$/],
    },
  })],
  build: { chunkSizeWarningLimit: 900 },
  test: {
    environment: 'node',
  },
});