import React, { useState, useEffect } from 'react';

interface CallRecord {
  id: number;
  caller_name: string;
  receiver_name: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  audio_url: string;
  status: string;
}

const MonitorPage: React.FC = () => {
  const [records, setRecords] = useState<CallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/history');
        if (!response.ok) {
          throw new Error('Failed to fetch history');
        }
        const data = await response.json();
        setRecords(data.history);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();

    const ws = new WebSocket(`wss://${window.location.hostname}:8443`);

    ws.onopen = () => {
      console.log('Monitor WebSocket connected');
      ws.send(JSON.stringify({ type: 'request-user-list' }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'user-list') {
        setOnlineUsers(data.users);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div className="bg-gray-900 text-white min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">VoIP 通話監控中心</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4">通話紀錄</h2>
          {isLoading && <p>載入中...</p>}
          {error && <p className="text-red-500">{error}</p>}
          {!isLoading && !error && records.length === 0 && <p>暫無通話紀錄</p>}
          {!isLoading && !error && records.length > 0 && (
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="py-2">主叫</th>
                  <th className="py-2">被叫</th>
                  <th className="py-2">開始時間</th>
                  <th className="py-2">持續時間</th>
                  <th className="py-2">錄音</th>
                </tr>
              </thead>
              <tbody>
                {records.map(record => (
                  <tr key={record.id} className="border-b border-gray-700">
                    <td className="py-2">{record.caller_name}</td>
                    <td className="py-2">{record.receiver_name}</td>
                    <td className="py-2">{new Date(record.start_time).toLocaleString()}</td>
                    <td className="py-2">{record.duration_seconds} 秒</td>
                    <td className="py-2">
                      {record.audio_url && (
                        <a href={`/api/download/${record.id}`} download className="text-blue-400 hover:underline">下載</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4">上線人員名單</h2>
          {onlineUsers.length > 0 ? (
            <ul>
              {onlineUsers.map(user => (
                <li key={user} className="py-1">{user}</li>
              ))}
            </ul>
          ) : (
            <p>無人在線</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonitorPage;
