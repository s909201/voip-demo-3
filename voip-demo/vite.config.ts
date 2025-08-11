import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 允許來自區域網路的連線
    https: {
      key: fs.readFileSync(path.resolve(__dirname, '../server-ui-demo/cert-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '../server-ui-demo/cert.pem')),
    },
    proxy: {
      '/api': {
        target: 'https://localhost:8443',
        changeOrigin: true,
        secure: false,
      },
    },
  }
})
