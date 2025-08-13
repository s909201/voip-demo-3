import { useState, useRef, useCallback, useEffect } from 'react';
import { uploadRecording } from '../services/api';

const useWebRTC = (socket: WebSocket | null, username: string, currentTarget: string) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [callState, setCallState] = useState('idle'); // idle, calling, incoming, connected
  const [callerId, setCallerId] = useState<string | null>(null);
  const [isCaller, setIsCaller] = useState<boolean>(false); // 追蹤是否為發起通話方
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const callId = useRef<string | null>(null);
  const incomingOffer = useRef<RTCSessionDescriptionInit | null>(null);
  const candidateQueue = useRef<RTCIceCandidateInit[]>([]);
  const ringtone = useRef<HTMLAudioElement | null>(null);

  const servers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop();
    }
  };

  const hangUp = useCallback((isRemote = false) => {
    if (peerConnection.current?.signalingState === 'closed') {
      return;
    }
    stopRecording();
    const target = callerId || currentTarget;
    const time = new Date().toLocaleString();
    if (!isRemote && socket && target) {
      console.log(`[${time}] [SIGNALING] Sending hang-up to: ${target}`);
      socket.send(JSON.stringify({ type: 'hang-up', target_voip_id: target }));
    }
    if (peerConnection.current) {
      peerConnection.current.ontrack = null;
      peerConnection.current.onicecandidate = null;
      peerConnection.current.onconnectionstatechange = null;
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (ringtone.current) {
      ringtone.current.pause();
      ringtone.current.currentTime = 0;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallState('idle');
    setCallerId(null);
    setIsCaller(false); // 重置發起通話標記
    incomingOffer.current = null;
  }, [socket, callerId, currentTarget, localStream]);

  const startRecording = useCallback(() => {
    const time = new Date().toLocaleString();
    console.log(`[${time}] [RECORDING] Attempting to start recording. LocalStream: ${!!localStream}, RemoteStream: ${!!remoteStream}, CallId: ${callId.current}, IsCaller: ${isCaller}`);
    
    if (localStream && remoteStream && callId.current) {
      const combinedStream = new MediaStream([...localStream.getTracks(), ...remoteStream.getTracks()]);
      
      // 使用 WAV 格式錄音
      const options = {
        mimeType: 'audio/webm;codecs=opus'
      };
      
      mediaRecorder.current = new MediaRecorder(combinedStream, options);
      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
          console.log(`[${new Date().toLocaleString()}] [RECORDING] Audio chunk received, size: ${event.data.size}`);
        }
      };
      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        audioChunks.current = [];
        console.log(`[${new Date().toLocaleString()}] [RECORDING] Recording stopped, blob size: ${audioBlob.size}, callId: ${callId.current}, isCaller: ${isCaller}`);
        
        if (callId.current && audioBlob.size > 0) {
          // 雙方都錄音，但只有發起方上傳
          if (isCaller) {
            setIsUploading(true);
            setUploadSuccess(null);
            setUploadError(null);
            try {
              console.log(`[${new Date().toLocaleString()}] [RECORDING] Uploading audio as caller...`);
              const response = await uploadRecording(audioBlob, callId.current, username, callerId || currentTarget);
              if (!response.ok) {
                throw new Error('Upload failed');
              }
              console.log(`[${new Date().toLocaleString()}] [RECORDING] Upload successful`);
              setUploadSuccess(true);
            } catch (error) {
              console.error(`[${new Date().toLocaleString()}] [RECORDING] Upload failed:`, error);
              setUploadSuccess(false);
              setUploadError(error instanceof Error ? error.message : 'Unknown error');
            } finally {
              setIsUploading(false);
            }
          } else {
            console.log(`[${new Date().toLocaleString()}] [RECORDING] Recording saved locally (receiver side)`);
            // 接聽方可以在這裡保存本地備份，但不上傳
            // 如果需要，可以實現本地儲存邏輯
          }
        } else {
          console.log(`[${new Date().toLocaleString()}] [RECORDING] No audio data to save`);
        }
      };
      mediaRecorder.current.start();
      console.log(`[${time}] [RECORDING] Recording started successfully`);
    } else {
      console.log(`[${time}] [RECORDING] Cannot start recording - missing requirements`);
    }
  }, [localStream, remoteStream]);

  const initializePeerConnection = useCallback((targetVoipId: string) => {
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    
    const pc = new RTCPeerConnection(servers);
    peerConnection.current = pc;
    
    // 生成 callId
    callId.current = `${username}-${targetVoipId}-${Date.now()}`;

    pc.ontrack = (event) => {
      const time = new Date().toLocaleString();
      console.log(`[${time}] [WebRTC] ontrack event received.`, event.streams);
      setRemoteStream(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      const time = new Date().toLocaleString();
      if (event.candidate) {
        if (socket && targetVoipId) {
          console.log(`[${time}] [SIGNALING] Sending candidate to: ${targetVoipId}`);
          socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate, target_voip_id: targetVoipId }));
        }
      } else {
        console.log(`[${time}] [WebRTC] End of candidates.`);
      }
    };

    pc.onconnectionstatechange = () => {
      const time = new Date().toLocaleString();
      const state = pc?.connectionState;
      console.log(`[${time}] [WebRTC] Connection state changed: ${state}`);
      if (state === 'connected') {
        setCallState('connected');
        startRecording();
      } else if (['disconnected', 'failed', 'closed'].includes(state)) {
        hangUp(true);
      }
    };
  }, [socket, hangUp, startRecording]);

  const startCall = async (targetVoipId: string) => {
    initializePeerConnection(targetVoipId);
    if (!peerConnection.current) return;

    setIsCaller(true); // 標記為發起通話方
    setCallState('calling');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    setLocalStream(stream);
    stream.getTracks().forEach(track => peerConnection.current!.addTrack(track, stream));

    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    
    const time = new Date().toLocaleString();
    console.log(`[${time}] [SIGNALING] Sending offer to: ${targetVoipId}`);
    if (socket) {
      socket.send(JSON.stringify({ type: 'offer', offer, target_voip_id: targetVoipId }));
    }
  };

  const handleReceiveOffer = (offer: RTCSessionDescriptionInit, callerVoipId: string, receivedCallId?: string | number) => {
    const time = new Date().toLocaleString();
    console.log(`[${time}] [SIGNALING] Received offer from: ${callerVoipId}, callId: ${receivedCallId}`);
    
    // 使用後端傳來的數據庫 callId
    if (receivedCallId) {
      callId.current = String(receivedCallId);
    }
    
    setIsCaller(false); // 標記為接聽方
    incomingOffer.current = offer;
    setCallerId(callerVoipId);
    setCallState('incoming');

    if (!ringtone.current) {
      ringtone.current = new Audio('/Cat-iPhone-ringtone.wav');
      ringtone.current.loop = true;
    }
    ringtone.current.play().catch(error => console.error("Ringtone play failed:", error));
  };

  const answerCall = async () => {
    if (!incomingOffer.current || !callerId) return;

    // 保存當前的 callId，因為 initializePeerConnection 會重新設置它
    const currentCallId = callId.current;
    
    initializePeerConnection(callerId);
    if (!peerConnection.current) return;

    // 恢復正確的 callId
    callId.current = currentCallId;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    setLocalStream(stream);
    stream.getTracks().forEach(track => peerConnection.current!.addTrack(track, stream));

    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(incomingOffer.current));

    while(candidateQueue.current.length > 0) {
      const candidate = candidateQueue.current.shift();
      if (candidate) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    }

    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);

    const time = new Date().toLocaleString();
    console.log(`[${time}] [SIGNALING] Sending answer to: ${callerId}`);
    if (socket) {
      socket.send(JSON.stringify({ type: 'answer', answer, target_voip_id: callerId }));
    }
    if (ringtone.current) {
      ringtone.current.pause();
      ringtone.current.currentTime = 0;
    }
    setCallState('connected');
    incomingOffer.current = null;
  };

  const handleReceiveAnswer = async (answer: RTCSessionDescriptionInit, receivedCallId?: string | number) => {
    if (peerConnection.current) {
      const time = new Date().toLocaleString();
      console.log(`[${time}] [SIGNALING] Received answer from: ${callerId || currentTarget}, callId: ${receivedCallId}`);
      
      // 更新 callId（發起方在這裡接收到後端的數據庫 callId）
      if (receivedCallId) {
        callId.current = String(receivedCallId);
      }
      
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      
      while(candidateQueue.current.length > 0) {
        const candidate = candidateQueue.current.shift();
        if (candidate) {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }

      setCallState('connected');
    }
  };

  const handleReceiveCandidate = async (candidate: RTCIceCandidateInit) => {
    const time = new Date().toLocaleString();
    console.log(`[${time}] [SIGNALING] Received candidate from: ${callerId || currentTarget}`);
    if (peerConnection.current && peerConnection.current.remoteDescription) {
      try {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error(`[${time}] [WebRTC] Error adding received ice candidate`, e);
      }
    } else {
      console.log(`[${time}] [WebRTC] Queuing candidate because remote description is not set yet.`);
      candidateQueue.current.push(candidate);
    }
  };

  // 當 localStream 和 remoteStream 都可用且通話狀態為 connected 時開始錄音
  useEffect(() => {
    if (localStream && remoteStream && callState === 'connected' && callId.current) {
      const time = new Date().toLocaleString();
      console.log(`[${time}] [RECORDING] Both streams available and call connected, starting recording...`);
      
      // 延遲一點時間確保音頻流穩定
      setTimeout(() => {
        if (localStream && remoteStream && callState === 'connected' && !mediaRecorder.current) {
          startRecording();
        }
      }, 1000);
    }
  }, [localStream, remoteStream, callState, startRecording]);

  return { localStream, remoteStream, callState, callerId, startCall, hangUp, answerCall, handleReceiveOffer, handleReceiveAnswer, handleReceiveCandidate, isUploading, uploadSuccess, uploadError };
};

export default useWebRTC;
