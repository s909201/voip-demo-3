require('dotenv').config();
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { initializeDatabase, db } = require('./src/database');
const { WebSocketServer } = require('ws');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const app = express();
const PORT = process.env.PORT || 8443;

// 設置 FFmpeg 路徑
ffmpeg.setFfmpegPath(ffmpegStatic);

app.use(cors());
app.use(express.json());

initializeDatabase();

// 確保 uploads 目錄存在
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// --- Multer Setup ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${req.body.callId}.webm`);
  },
});

const upload = multer({ storage });

// --- API Routes ---
app.post('/api/upload', upload.single('audio'), (req, res) => {
  const { callId, callerName, receiverName } = req.body;
  
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  const inputPath = req.file.path;
  
  // 生成新的檔案名格式：2025-08-12-18-22-40-user1-user2.wav
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  
  const fileName = `${year}-${month}-${day}-${hour}-${minute}-${second}-${callerName || 'unknown'}-${receiverName || 'unknown'}.wav`;
  const outputPath = path.join('uploads', fileName);
  
  // 轉換 WebM 到 WAV
  ffmpeg(inputPath)
    .toFormat('wav')
    .on('end', () => {
      console.log(`Audio conversion completed for call ${callId}`);
      
      // 刪除原始 WebM 文件
      fs.unlink(inputPath, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Error deleting original file:', unlinkErr);
        }
      });
      
      // 更新數據庫記錄
      const audioUrl = `uploads/${fileName}`;
      db.run('UPDATE call_history SET audio_url = ? WHERE id = ?', [audioUrl, callId], (err) => {
        if (err) {
          console.error('Database update error:', err);
          return res.status(500).json({ error: err.message });
        }
        res.json({ 
          message: 'File uploaded and converted successfully',
          audioUrl: audioUrl
        });
      });
    })
    .on('error', (err) => {
      console.error('FFmpeg conversion error:', err);
      
      // 清理失敗的文件
      fs.unlink(inputPath, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Error deleting failed file:', unlinkErr);
        }
      });
      
      res.status(500).json({ error: 'Audio conversion failed' });
    })
    .save(outputPath);
});

app.get('/api/download/:callId', (req, res) => {
  const { callId } = req.params;
  db.get('SELECT audio_url FROM call_history WHERE id = ?', [callId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (row && row.audio_url) {
      const filePath = path.join(__dirname, row.audio_url);
      
      // 檢查文件是否存在
      if (fs.existsSync(filePath)) {
        // 從 audio_url 中提取原始檔名
        const originalFileName = path.basename(row.audio_url);
        res.setHeader('Content-Disposition', `attachment; filename="${originalFileName}"`);
        res.setHeader('Content-Type', 'audio/wav');
        res.download(filePath, originalFileName);
      } else {
        res.status(404).json({ message: 'Audio file not found on server' });
      }
    } else {
      res.status(404).json({ message: 'Call record not found or no audio available' });
    }
  });
});

app.get('/api/history', (req, res) => {
  db.all(`
    SELECT 
      ch.id,
      uc.name as caller_name,
      ur.name as receiver_name,
      ch.caller_ip,
      ch.receiver_ip,
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

const formatIp = (ip) => {
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  return ip;
};

server.listen(PORT, '0.0.0.0', () => {
  console.log(`伺服器正在 https://0.0.0.0:${PORT} 上運行`);
  console.log(`可透過以下網址存取:`);
  console.log(`  - https://localhost:${PORT}`);
  console.log(`  - https://192.168.0.75:${PORT}`);
});

const onlineUsers = new Map();
const activeCalls = new Map(); // 追蹤進行中的通話

// 輔助函數：獲取或創建用戶
const getOrCreateUser = (voip_id, callback) => {
  db.get('SELECT id FROM users WHERE voip_id = ?', [voip_id], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return callback(null);
    }
    if (row) {
      callback(row.id);
    } else {
      // 創建新用戶
      db.run('INSERT INTO users (name, voip_id) VALUES (?, ?)', [voip_id, voip_id], function(err) {
        if (err) {
          console.error('Error creating user:', err);
          return callback(null);
        }
        callback(this.lastID);
      });
    }
  });
};

const broadcastUserList = () => {
  const userList = Array.from(onlineUsers.values()).map(user => ({
    name: user.voip_id,
    ip: user.ip,
    loginTime: user.loginTime,
  }));

  const message = JSON.stringify({
    type: 'user-list',
    users: userList,
  });

  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });
};

const broadcastCallStatus = () => {
  const activeCallsList = Array.from(activeCalls.values()).map(call => ({
    id: call.callId,
    caller: call.caller,
    receiver: call.receiver,
    startTime: call.startTime.toISOString(),
    duration: Math.floor((new Date() - call.startTime) / 1000)
  }));

  const message = JSON.stringify({
    type: 'call-status',
    calls: activeCallsList,
  });

  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });
};

// 定期更新通話時長
const callStatusInterval = setInterval(() => {
  if (activeCalls.size > 0) {
    broadcastCallStatus();
  }
}, 1000); // 每秒更新一次

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('connection', (ws, req) => {
  const rawIp = req.socket.remoteAddress;
  const ip = formatIp(rawIp);
  if (ip === '::1') {
    ws.terminate();
    return;
  }
  const time = new Date().toLocaleString();
  console.log(`[${time}] 客戶端已連線，來源 IP: ${ip}`);
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'login':
        ws.voip_id = data.voip_id;
        onlineUsers.set(data.voip_id, {
          ws: ws,
          voip_id: data.voip_id,
          ip: ip,
          loginTime: new Date().toISOString(),
        });
        broadcastUserList();
        break;
      case 'request-user-list':
        const userList = Array.from(onlineUsers.values()).map(user => ({
          name: user.voip_id,
          ip: user.ip,
          loginTime: user.loginTime,
        }));
        ws.send(JSON.stringify({
          type: 'user-list',
          users: userList,
        }));
        break;
      case 'offer': {
        const time = new Date().toLocaleString();
        console.log(`[${time}] [SIGNALING] offer from ${ws.voip_id} to ${data.target_voip_id}`);
        console.log(JSON.stringify(data.offer, null, 2));
        const targetUser = onlineUsers.get(data.target_voip_id);
        if (targetUser) {
          // 只轉發 offer，不創建通話記錄
          const messageWithSender = { 
            ...data, 
            sender_voip_id: ws.voip_id
          };
          targetUser.ws.send(JSON.stringify(messageWithSender));
        } else {
          console.log(`[${time}] [SIGNALING] Target user ${data.target_voip_id} not found.`);
        }
        break;
      }
      case 'answer': {
        const time = new Date().toLocaleString();
        console.log(`[${time}] [SIGNALING] answer from ${ws.voip_id} to ${data.target_voip_id}`);
        console.log(JSON.stringify(data.answer, null, 2));
        const targetUser = onlineUsers.get(data.target_voip_id);
        if (targetUser) {
          // 在接聽時創建通話記錄
          const callKey = `${data.target_voip_id}-${ws.voip_id}`;
          
          getOrCreateUser(data.target_voip_id, (callerId) => {
            getOrCreateUser(ws.voip_id, (receiverId) => {
              if (callerId && receiverId) {
                const callerUser = onlineUsers.get(data.target_voip_id);
                const receiverUser = onlineUsers.get(ws.voip_id);
                
                db.run(`INSERT INTO call_history 
                  (caller_id, receiver_id, caller_ip, receiver_ip, start_time, status) 
                  VALUES (?, ?, ?, ?, ?, ?)`, 
                  [callerId, receiverId, callerUser.ip, receiverUser.ip, new Date().toISOString(), 'connected'], 
                  function(err) {
                    if (err) {
                      console.error('Error creating call record:', err);
                    } else {
                      const dbCallId = this.lastID;
                      activeCalls.set(callKey, {
                        callId: dbCallId,
                        startTime: new Date(),
                        caller: data.target_voip_id,
                        receiver: ws.voip_id
                      });
                      console.log(`[${time}] Call record created with ID: ${dbCallId}`);
                      
                      // 將 callId 包含在發送給發起方的消息中
                      const messageWithSender = { 
                        ...data, 
                        sender_voip_id: ws.voip_id,
                        callId: dbCallId 
                      };
                      targetUser.ws.send(JSON.stringify(messageWithSender));
                      broadcastCallStatus();
                    }
                  }
                );
              }
            });
          });
        } else {
          console.log(`[${time}] [SIGNALING] Target user ${data.target_voip_id} not found.`);
        }
        break;
      }
      case 'hang-up': {
        const time = new Date().toLocaleString();
        console.log(`[${time}] [SIGNALING] hang-up from ${ws.voip_id} to ${data.target_voip_id}`);
        const targetUser = onlineUsers.get(data.target_voip_id);
        if (targetUser) {
          const messageWithSender = { ...data, sender_voip_id: ws.voip_id };
          targetUser.ws.send(JSON.stringify(messageWithSender));
        } else {
          console.log(`[${time}] [SIGNALING] Target user ${data.target_voip_id} not found.`);
        }
        
        // 結束通話記錄
        const callKey1 = `${ws.voip_id}-${data.target_voip_id}`;
        const callKey2 = `${data.target_voip_id}-${ws.voip_id}`;
        const callInfo = activeCalls.get(callKey1) || activeCalls.get(callKey2);
        
        if (callInfo) {
          const endTime = new Date();
          const durationSeconds = Math.floor((endTime - callInfo.startTime) / 1000);
          
          db.run(`UPDATE call_history 
            SET end_time = ?, duration_seconds = ?, status = ? 
            WHERE id = ?`, 
            [endTime.toISOString(), durationSeconds, 'completed', callInfo.callId], 
            (err) => {
              if (err) {
                console.error('Error updating call end time:', err);
              } else {
                console.log(`[${time}] Call ${callInfo.callId} completed, duration: ${durationSeconds}s`);
              }
            }
          );
          
          // 清除活動通話記錄
          activeCalls.delete(callKey1);
          activeCalls.delete(callKey2);
          broadcastCallStatus();
        }
        break;
      }
      case 'candidate': {
        const time = new Date().toLocaleString();
        console.log(`[${time}] [SIGNALING] candidate from ${ws.voip_id} to ${data.target_voip_id}`);
        console.log(JSON.stringify(data.candidate, null, 2));
        const targetUser = onlineUsers.get(data.target_voip_id);
        if (targetUser) {
          const messageWithSender = { ...data, sender_voip_id: ws.voip_id };
          targetUser.ws.send(JSON.stringify(messageWithSender));
        } else {
          console.log(`[${time}] [SIGNALING] Target user ${data.target_voip_id} not found.`);
        }
        break;
      }
      default:
        break;
    }
  });

  ws.on('close', () => {
    if (ws.voip_id && onlineUsers.has(ws.voip_id)) {
      // 處理未完成的通話記錄
      for (const [callKey, callInfo] of activeCalls.entries()) {
        if (callInfo.caller === ws.voip_id || callInfo.receiver === ws.voip_id) {
          const endTime = new Date();
          const durationSeconds = Math.floor((endTime - callInfo.startTime) / 1000);
          
          db.run(`UPDATE call_history 
            SET end_time = ?, duration_seconds = ?, status = ? 
            WHERE id = ?`, 
            [endTime.toISOString(), durationSeconds, 'disconnected', callInfo.callId], 
            (err) => {
              if (err) {
                console.error('Error updating call on disconnect:', err);
              } else {
                console.log(`Call ${callInfo.callId} marked as disconnected due to user leaving`);
              }
            }
          );
          
          activeCalls.delete(callKey);
        }
      }
      
      onlineUsers.delete(ws.voip_id);
      broadcastUserList();
      broadcastCallStatus();
    }
    const closeTime = new Date().toLocaleString();
    console.log(`[${closeTime}] 客戶端已離線，來源 IP: ${ip}`);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

wss.on('close', () => {
  clearInterval(interval);
});
