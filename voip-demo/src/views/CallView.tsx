import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import useWebRTC from '../hooks/useWebRTC';

interface OnlineUser {
  name: string;
  ip: string;
  loginTime: string;
}

const CallView: React.FC = () => {
  const [username, setUsername] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [currentTarget, setCurrentTarget] = useState<string>('');
  const { remoteStream, callState, callerId, startCall, hangUp, answerCall, handleReceiveOffer, handleReceiveAnswer, handleReceiveCandidate } = useWebRTC(socket, username, currentTarget);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(error => console.error("Error playing remote audio:", error));
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!socket) return;

    const messageHandler = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'user-list':
          setOnlineUsers(data.users.filter((user: OnlineUser) => user.name !== username));
          break;
        case 'offer':
          handleReceiveOffer(data.offer, data.sender_voip_id, data.callId);
          break;
        case 'answer':
          handleReceiveAnswer(data.answer, data.callId);
          break;
        case 'candidate':
          handleReceiveCandidate(data.candidate);
          break;
        case 'hang-up':
          hangUp(true);
          break;
        default:
          break;
      }
    };

    const closeHandler = () => {
      console.log('WebSocket disconnected');
      setConnectionStatus('disconnected');
      setOnlineUsers([]);
      setSocket(null);
    };

    const errorHandler = (error: Event) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
    };

    socket.onmessage = messageHandler;
    socket.onclose = closeHandler;
    socket.onerror = errorHandler;

    return () => {
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
    };
  }, [socket, username, handleReceiveOffer, handleReceiveAnswer, handleReceiveCandidate, hangUp]);

  const handleConnect = () => {
    if (!username.trim()) {
      alert('請輸入你的名字');
      return;
    }
    setConnectionStatus('connecting');
    // 強制使用 WSS 協議連接到後端服務器
    const wsUrl = `wss://${window.location.hostname}:8443`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      ws.send(JSON.stringify({ type: 'login', voip_id: username }));
      ws.send(JSON.stringify({ type: 'request-user-list' }));
      setConnectionStatus('connected');
    };

    setSocket(ws);
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center p-4">
      {/* 導航連結 */}
      <div className="fixed top-4 right-4 flex space-x-4 z-10">
        <Link 
          to="/monitor" 
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2"
        >
          <span>📊</span>
          <span>即時監控</span>
        </Link>
        <Link 
          to="/history" 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2"
        >
          <span>📋</span>
          <span>通話紀錄</span>
        </Link>
      </div>

      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-sm" style={{ transform: 'translateY(-100px)' }}>
        <h1 className="text-2xl font-bold mb-6 text-center">安心聊</h1>
        
        <div className="mb-4">
          <label htmlFor="username" className="block text-sm font-medium text-gray-400 mb-2">你的名字</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="請輸入你的名字"
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={connectionStatus !== 'disconnected'}
          />
        </div>

        <button 
          onClick={handleConnect}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 mb-6 disabled:bg-gray-500"
          disabled={connectionStatus !== 'disconnected'}
        >
          {connectionStatus === 'connecting' ? '連線中...' : '連線'}
        </button>

        <div className="mb-4">
          <label htmlFor="contact" className="block text-sm font-medium text-gray-400 mb-2">選擇聯絡人</label>
          <select
            id="contact"
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={connectionStatus !== 'connected'}
          >
            {onlineUsers.length > 0 ? (
              onlineUsers.map((user) => (
                <option key={user.name} value={user.name}>{user.name}</option>
              ))
            ) : (
              <option>無其他在線使用者</option>
            )}
          </select>
        </div>

        {callState === 'incoming' && (
          <div className="mt-6 text-center">
            <p className="mb-4">{callerId} 正在來電...</p>
            <button onClick={answerCall} className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full transition duration-300">
              接聽
            </button>
          </div>
        )}

        <div className="flex justify-around mt-6">
          <button 
            onClick={() => {
              const target = (document.getElementById('contact') as HTMLSelectElement).value;
              if (target) {
                setCurrentTarget(target);
                startCall(target);
              }
            }}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full transition duration-300 disabled:bg-gray-500" 
            disabled={connectionStatus !== 'connected' || callState !== 'idle'}
          >
            {callState === 'calling' ? '撥號中...' : '撥號'}
          </button>
          <button 
            onClick={() => hangUp()} 
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-full transition duration-300 disabled:bg-gray-500" 
            disabled={callState === 'idle'}
          >
            掛斷
          </button>
        </div>
        
        <audio ref={remoteAudioRef} autoPlay playsInline />
      </div>
    </div>
  );
};

export default CallView;
