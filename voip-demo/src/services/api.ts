export const uploadRecording = async (audioBlob: Blob, callId: string, callerName?: string, receiverName?: string): Promise<Response> => {
  const formData = new FormData();
  formData.append('audio', audioBlob, `${callId}.webm`);
  formData.append('callId', callId);
  if (callerName) formData.append('callerName', callerName);
  if (receiverName) formData.append('receiverName', receiverName);

  return fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
};

export interface CallHistoryRecord {
  id: number;
  caller_name: string;
  receiver_name: string;
  caller_ip: string;
  receiver_ip: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  audio_url: string;
  status: string;
}

export const getCallHistory = async (): Promise<CallHistoryRecord[]> => {
  const response = await fetch('/api/history');
  if (!response.ok) {
    throw new Error('Failed to fetch call history');
  }
  const data = await response.json();
  return data.history;
};

export const downloadRecording = (callId: number): string => {
  return `/api/download/${callId}`;
};
