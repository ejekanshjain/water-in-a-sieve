import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { devHttps } from './dev-https.js'

// `SIEVE_HTTPS=1 bunx vite` serves over HTTPS, so phones on the LAN can send motion.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5175, strictPort: true, host: true, https: devHttps() },
  preview: { port: 5275, strictPort: true }
})
