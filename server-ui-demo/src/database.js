const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./voip_demo.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the voip_demo.db database.');
});

const initializeDatabase = () => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      voip_id TEXT NOT NULL UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS call_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caller_id INTEGER,
      receiver_id INTEGER,
      caller_ip TEXT,
      receiver_ip TEXT,
      start_time TEXT,
      end_time TEXT,
      duration_seconds INTEGER,
      audio_url TEXT,
      status TEXT,
      FOREIGN KEY (caller_id) REFERENCES users (id),
      FOREIGN KEY (receiver_id) REFERENCES users (id)
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_caller_id ON call_history (caller_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_receiver_id ON call_history (receiver_id)`);
    
    console.log('Database tables and indexes are set up.');
  });
};

module.exports = { db, initializeDatabase };
