import { defineConfig } from 'vite'
import type { ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { WebSocketServer, WebSocket } from 'ws'

const logPlugin = () => {
  return {
    name: 'log-plugin',
    configureServer(server: ViteDevServer) {
      const wss = new WebSocketServer({ port: 24678 });
      wss.on('connection', (ws: WebSocket) => {
        ws.on('message', (message: Buffer) => {
          console.log(message.toString());
        });
      });
      console.log('Log WebSocket server running on ws://localhost:24678');
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), logPlugin()],
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
