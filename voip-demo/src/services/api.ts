export const uploadRecording = async (audioBlob: Blob, callId: string): Promise<Response> => {
  const formData = new FormData();
  formData.append('audio', audioBlob, `${callId}.webm`);
  formData.append('callId', callId);

  return fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
};
