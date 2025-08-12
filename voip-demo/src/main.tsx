import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// --- Log Forwarding to Vite Terminal ---
if (import.meta.env.DEV) {
  const ws = new WebSocket('ws://localhost:24678');
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  ws.onopen = () => {
    originalLog('Log forwarding to terminal enabled.');
  };

  ws.onerror = (error) => {
    originalError('Log forwarding WebSocket error:', error);
  };

  const sendLog = (level: string, ...args: any[]) => {
    try {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
      ).join(' ');
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(`[${level.toUpperCase()}] ${message}`);
      }
    } catch (e) {
      originalError('Failed to send log:', e);
    }
  };

  console.log = (...args) => {
    originalLog.apply(console, args);
    sendLog('log', ...args);
  };

  console.error = (...args) => {
    originalError.apply(console, args);
    sendLog('error', ...args);
  };

  console.warn = (...args) => {
    originalWarn.apply(console, args);
    sendLog('warn', ...args);
  };
}
// --- End Log Forwarding ---


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
