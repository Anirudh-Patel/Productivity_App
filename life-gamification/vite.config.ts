import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
      '@store': fileURLToPath(new URL('./src/store', import.meta.url)),
      '@utils': fileURLToPath(new URL('./src/shared/utils', import.meta.url)),
      '@hooks': fileURLToPath(new URL('./src/shared/hooks', import.meta.url)),
      '@components': fileURLToPath(new URL('./src/shared/components', import.meta.url)),
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
}))