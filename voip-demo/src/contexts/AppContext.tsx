import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface OnlineUser {
  name: string;
  ip: string;
  loginTime: string;
}

interface AppContextType {
  username: string;
  setUsername: (username: string) => void;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  setConnectionStatus: (status: 'disconnected' | 'connecting' | 'connected') => void;
  onlineUsers: OnlineUser[];
  setOnlineUsers: (users: OnlineUser[]) => void;
  socket: WebSocket | null;
  setSocket: (socket: WebSocket | null) => void;
  currentTarget: string;
  setCurrentTarget: (target: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [username, setUsername] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [currentTarget, setCurrentTarget] = useState<string>('');

  // 清理 WebSocket 連接
  useEffect(() => {
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [socket]);

  const value: AppContextType = {
    username,
    setUsername,
    connectionStatus,
    setConnectionStatus,
    onlineUsers,
    setOnlineUsers,
    socket,
    setSocket,
    currentTarget,
    setCurrentTarget,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
