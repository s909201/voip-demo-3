import { useState, useRef, useEffect } from 'react';
import { uploadRecording } from '../services/api';

const useWebRTC = (socket: WebSocket | null, username: string, currentTarget: string) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [callState, setCallState] = useState('idle'); // idle, calling, incoming, connected
  const [callerId, setCallerId] = useState<string | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const callId = useRef<string | null>(null);
  const incomingOffer = useRef<RTCSessionDescriptionInit | null>(null);

  const servers = {
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302',
      },
    ],
  };

  useEffect(() => {
    if (!socket) return;

    peerConnection.current = new RTCPeerConnection(servers);

    peerConnection.current.ontrack = (event) => {
      const time = new Date().toLocaleString();
      console.log(`[${time}] [WebRTC] ontrack event received.`, event.streams);
      setRemoteStream(event.streams[0]);
    };

    peerConnection.current.onicecandidate = (event) => {
      const time = new Date().toLocaleString();
      if (event.candidate) {
        if (socket) {
          const target = callerId || currentTarget;
          if (target) {
            console.log(`[${time}] [SIGNALING] Sending candidate to: ${target}`);
            console.log(JSON.stringify(event.candidate, null, 2));
            socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate, target_voip_id: target }));
          }
        }
      } else {
        console.log(`[${time}] [WebRTC] End of candidates.`);
      }
    };

    const pc = peerConnection.current;
    return () => {
      pc?.close();
    };
  }, [socket]);

  const startCall = async (targetVoipId: string) => {
    if (!peerConnection.current) return;
    callId.current = `${username}-${targetVoipId}-${Date.now()}`;
    setCallState('calling');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    setLocalStream(stream);
    stream.getTracks().forEach(track => peerConnection.current!.addTrack(track, stream));

    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    
    const time = new Date().toLocaleString();
    console.log(`[${time}] [SIGNALING] Sending offer to: ${targetVoipId}`);
    console.log(JSON.stringify(offer, null, 2));

    if (socket) {
      socket.send(JSON.stringify({ type: 'offer', offer, target_voip_id: targetVoipId }));
    }
  };

  const hangUp = () => {
    stopRecording();
    const target = callerId || currentTarget;
    const time = new Date().toLocaleString();
    if (socket && target) {
      console.log(`[${time}] [SIGNALING] Sending hang-up to: ${target}`);
      socket.send(JSON.stringify({ type: 'hang-up', target_voip_id: target }));
    }
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallState('idle');
    setCallerId(null);
    incomingOffer.current = null;
  };

  const handleReceiveOffer = async (offer: RTCSessionDescriptionInit, callerVoipId: string) => {
    if (!peerConnection.current) return;
    const time = new Date().toLocaleString();
    console.log(`[${time}] [SIGNALING] Received offer from: ${callerVoipId}`);
    console.log(JSON.stringify(offer, null, 2));
    incomingOffer.current = offer;
    setCallerId(callerVoipId);
    setCallState('incoming');
  };

  const answerCall = async () => {
    if (!peerConnection.current || !incomingOffer.current || !callerId) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    setLocalStream(stream);
    stream.getTracks().forEach(track => peerConnection.current!.addTrack(track, stream));

    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(incomingOffer.current));

    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);

    const time = new Date().toLocaleString();
    console.log(`[${time}] [SIGNALING] Sending answer to: ${callerId}`);
    console.log(JSON.stringify(answer, null, 2));

    if (socket) {
      socket.send(JSON.stringify({ type: 'answer', answer, target_voip_id: callerId }));
    }
    setCallState('connected');
    incomingOffer.current = null;
  };

  const handleReceiveAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (peerConnection.current) {
      const time = new Date().toLocaleString();
      console.log(`[${time}] [SIGNALING] Received answer from: ${callerId || currentTarget}`);
      console.log(JSON.stringify(answer, null, 2));
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      setCallState('connected');
    }
  };

  const handleReceiveCandidate = async (candidate: RTCIceCandidateInit) => {
    if (peerConnection.current) {
      const time = new Date().toLocaleString();
      console.log(`[${time}] [SIGNALING] Received candidate from: ${callerId || currentTarget}`);
      console.log(JSON.stringify(candidate, null, 2));
      try {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error(`[${time}] [WebRTC] Error adding received ice candidate`, e);
      }
    }
  };

  const startRecording = () => {
    if (localStream && remoteStream) {
      const combinedStream = new MediaStream([...localStream.getTracks(), ...remoteStream.getTracks()]);
      mediaRecorder.current = new MediaRecorder(combinedStream);
      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };
      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        audioChunks.current = [];
        if (callId.current) {
          setIsUploading(true);
          setUploadSuccess(null);
          setUploadError(null);
          try {
            const response = await uploadRecording(audioBlob, callId.current);
            if (!response.ok) {
              throw new Error('Upload failed');
            }
            setUploadSuccess(true);
          } catch (error) {
            setUploadSuccess(false);
            setUploadError(error instanceof Error ? error.message : 'Unknown error');
          } finally {
            setIsUploading(false);
          }
        }
      };
      mediaRecorder.current.start();
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop();
    }
  };

  useEffect(() => {
    if (peerConnection.current) {
      peerConnection.current.onconnectionstatechange = () => {
        const time = new Date().toLocaleString();
        const state = peerConnection.current?.connectionState;
        console.log(`[${time}] [WebRTC] Connection state changed: ${state}`);
        if (state === 'connected') {
          setCallState('connected');
          startRecording();
        }
      };
    }
  }, [localStream, remoteStream]);

  return { localStream, remoteStream, callState, callerId, startCall, hangUp, answerCall, handleReceiveOffer, handleReceiveAnswer, handleReceiveCandidate, stopRecording };
};

export default useWebRTC;
