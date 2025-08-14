import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface ActiveCall {
  id: number;
  caller: string;
  receiver: string;
  startTime: string;
  duration: number;
}

interface OnlineUser {
  name: string;
  ip: string;
  loginTime: string;
}

const MonitorPage: React.FC = () => {
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const websocket = new WebSocket('wss://192.168.0.75:8443');
    
    websocket.onopen = () => {
      console.log('[MONITOR] WebSocket connected');
      // 請求用戶列表
      websocket.send(JSON.stringify({ type: 'request-user-list' }));
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'user-list':
          setOnlineUsers(data.users);
          break;
        case 'call-status':
          setActiveCalls(data.calls);
          break;
      }
    };

    websocket.onclose = () => {
      console.log('[MONITOR] WebSocket disconnected');
    };

    websocket.onerror = (error) => {
      console.error('[MONITOR] WebSocket error:', error);
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, []);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (isoString: string): string => {
    return new Date(isoString).toLocaleString('zh-TW');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">通話監控中心</h1>
          <div className="flex space-x-4">
            <Link 
              to="/" 
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2"
            >
              <span>📞</span>
              <span>返回通話</span>
            </Link>
          </div>
        </div>
        
        {/* 即時通話狀態 */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-green-400">
            🔴 進行中通話 ({activeCalls.length})
          </h2>
          
          {activeCalls.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-400">
              目前沒有進行中的通話
            </div>
          ) : (
            <div className="grid gap-4">
              {activeCalls.map((call) => (
                <div key={call.id} className="bg-green-900/30 border border-green-500 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <div>
                        <div className="text-lg font-semibold">
                          {call.caller} ↔ {call.receiver}
                        </div>
                        <div className="text-sm text-gray-300">
                          通話 ID: {call.id} | 開始時間: {formatTime(call.startTime)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-mono text-green-400">
                        {formatDuration(call.duration)}
                      </div>
                      <div className="text-sm text-gray-300">通話時長</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 線上用戶列表 */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-blue-400">
            👥 線上用戶 ({onlineUsers.length})
          </h2>
          
          {onlineUsers.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-400">
              目前沒有用戶在線
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {onlineUsers.map((user, index) => (
                <div key={index} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <div>
                      <div className="font-semibold">{user.name}</div>
                      <div className="text-sm text-gray-400">IP: {user.ip}</div>
                      <div className="text-xs text-gray-500">
                        上線時間: {formatTime(user.loginTime)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 連線狀態指示器 */}
        <div className="fixed bottom-4 right-4">
          <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${
            ws?.readyState === WebSocket.OPEN 
              ? 'bg-green-600' 
              : 'bg-red-600'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              ws?.readyState === WebSocket.OPEN 
                ? 'bg-white animate-pulse' 
                : 'bg-white'
            }`}></div>
            <span className="text-sm font-medium">
              {ws?.readyState === WebSocket.OPEN ? '已連線' : '未連線'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonitorPage;
