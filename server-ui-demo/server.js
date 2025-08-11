require('dotenv').config();
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { initializeDatabase } = require('./src/database');
const { WebSocketServer } = require('ws');
const multer = require('multer');
const app = express();
const PORT = process.env.PORT || 8443;

app.use(cors());
app.use(express.json());

initializeDatabase();

// --- Multer Setup ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${req.body.callId}.webm`);
  },
});

const upload = multer({ storage });

// --- API Routes ---
app.post('/api/upload', upload.single('audio'), (req, res) => {
  const { callId } = req.body;
  const audioUrl = `uploads/${callId}.webm`;
  db.run('UPDATE call_history SET audio_url = ? WHERE id = ?', [audioUrl, callId], (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'File uploaded successfully' });
  });
});

app.get('/api/download/:callId', (req, res) => {
  const { callId } = req.params;
  db.get('SELECT audio_url FROM call_history WHERE id = ?', [callId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (row && row.audio_url) {
      res.download(path.join(__dirname, row.audio_url));
    } else {
      res.status(404).json({ message: 'File not found' });
    }
  });
});

app.get('/api/history', (req, res) => {
  db.all(`
    SELECT 
      ch.id,
      uc.name as caller_name,
      ur.name as receiver_name,
      ch.start_time,
      ch.end_time,
      ch.duration_seconds,
      ch.audio_url,
      ch.status
    FROM call_history ch
    LEFT JOIN users uc ON ch.caller_id = uc.id
    LEFT JOIN users ur ON ch.receiver_id = ur.id
    ORDER BY ch.start_time DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ history: rows });
  });
});

app.get('/', (req, res) => {
  res.send('安心聊後端伺服器已啟動');
});

// --- HTTPS and WebSocket Server Setup ---
const serverOptions = {
  key: fs.readFileSync(path.join(__dirname, 'cert-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
};

const server = https.createServer(serverOptions, app);

const wss = new WebSocketServer({ server });

server.listen(PORT, () => {
  console.log(`伺服器正在 https://localhost:${PORT} 上運行`);
});

const onlineUsers = new Map();

const broadcastUserList = () => {
  const userList = JSON.stringify({
    type: 'user-list',
    users: Array.from(onlineUsers.keys()),
  });
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(userList);
    }
  });
};

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('connection', (ws) => {
  console.log('客戶端已連線');
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'login':
        ws.voip_id = data.voip_id;
        onlineUsers.set(data.voip_id, ws);
        broadcastUserList();
        break;
      case 'request-user-list':
        ws.send(JSON.stringify({
          type: 'user-list',
          users: Array.from(onlineUsers.keys()),
        }));
        break;
      case 'offer':
      case 'answer':
      case 'candidate':
      case 'hang-up':
        const targetWs = onlineUsers.get(data.target_voip_id);
        if (targetWs) {
          const messageWithSender = {
            ...data,
            sender_voip_id: ws.voip_id,
          };
          targetWs.send(JSON.stringify(messageWithSender));
        }
        break;
      default:
        break;
    }
  });

  ws.on('close', () => {
    if (ws.voip_id && onlineUsers.get(ws.voip_id) === ws) {
      onlineUsers.delete(ws.voip_id);
      broadcastUserList();
    }
    console.log('客戶端已離線');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

wss.on('close', () => {
  clearInterval(interval);
});
