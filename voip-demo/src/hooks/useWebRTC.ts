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
    peerConnection.current = new RTCPeerConnection(servers);

    peerConnection.current.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate, target_voip_id: currentTarget }));
      }
    };

    return () => {
      peerConnection.current?.close();
    };
  }, [socket, currentTarget]);

  const startCall = async (targetVoipId: string) => {
    if (!peerConnection.current) return;
    callId.current = `${username}-${targetVoipId}-${Date.now()}`;
    setCallState('calling');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    setLocalStream(stream);
    stream.getTracks().forEach(track => peerConnection.current!.addTrack(track, stream));

    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);

    if (socket) {
      socket.send(JSON.stringify({ type: 'offer', offer, target_voip_id: targetVoipId }));
    }
  };

  const hangUp = () => {
    stopRecording();
    if (socket && (callerId || currentTarget)) {
      socket.send(JSON.stringify({ type: 'hang-up', target_voip_id: callerId || currentTarget }));
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
    incomingOffer.current = offer;
    setCallerId(callerVoipId);
    setCallState('incoming');
  };

  const answerCall = async () => {
    if (!peerConnection.current || !incomingOffer.current || !callerId) return;

    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(incomingOffer.current));

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    setLocalStream(stream);
    stream.getTracks().forEach(track => peerConnection.current!.addTrack(track, stream));

    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);

    if (socket) {
      socket.send(JSON.stringify({ type: 'answer', answer, target_voip_id: callerId }));
    }
    setCallState('connected');
    incomingOffer.current = null;
    setCallerId(null);
  };

  const handleReceiveAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (peerConnection.current) {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleReceiveCandidate = async (candidate: RTCIceCandidateInit) => {
    if (peerConnection.current) {
      await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
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
        if (peerConnection.current?.connectionState === 'connected') {
          setCallState('connected');
          startRecording();
        }
      };
    }
  }, [localStream, remoteStream]);

  return { localStream, remoteStream, callState, callerId, startCall, hangUp, answerCall, handleReceiveOffer, handleReceiveAnswer, handleReceiveCandidate, stopRecording };
};

export default useWebRTC;
