import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useWorkflowStore } from '../../store/workflowStore';

/**
 * Web implementation of CameraView.
 * Uses navigator.mediaDevices.getUserMedia to stream video from the webcam.
 * Automatically exposes camera ref to workflowStore for single-frame captures.
 */
export function CameraView() {
  const { setCameraRef, facing } = useWorkflowStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        setErrorMsg(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing === 'back' ? 'environment' : 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.error('Failed to access webcam:', err);
        setErrorMsg(err.message || 'Webcam access denied. Please allow camera permissions.');
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setCameraRef(null);
    };
  }, [facing, setCameraRef]);

  // Set the camera ref hook so LeftControls can capture images on Web
  useEffect(() => {
    if (videoRef.current && !errorMsg) {
      const webCameraMock = {
        takePictureAsync: async () => {
          const video = videoRef.current;
          if (!video) throw new Error('Video element not ready');

          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;

          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not create canvas context');

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          const base64 = dataUrl.split(',')[1];

          return {
            uri: dataUrl,
            base64: base64,
          };
        },
      };
      setCameraRef(webCameraMock);
    }
  }, [videoRef.current, errorMsg, setCameraRef]);

  if (errorMsg) {
    return (
      <View style={styles.container}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.title}>Camera Error</Text>
        <Text style={styles.subtitle}>{errorMsg}</Text>
      </View>
    );
  }

  return (
    <View style={styles.videoContainer}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: facing === 'front' ? 'scaleX(-1)' : 'none',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  icon: {
    fontSize: 64,
  },
  title: {
    color: '#e2e8f0',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
});
