import React, { useEffect } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CameraView } from '../../components/camera/CameraView';
import { AROverlay } from '../../components/ar/AROverlay';
import { StatusCapsule } from '../../components/capsule/StatusCapsule';
import { LeftControls } from '../../components/ui/LeftControls';
import { HazardSheet } from '../../components/sheet/HazardSheet';
import { AskAIButton } from '../../components/ui/AskAIButton';
import { useWsStore } from '../../store/wsStore';
import { useWorkflowStore, WorkflowState, ActiveModeType } from '../../store/workflowStore';
import { BlurView } from 'expo-blur';
import Svg, { Circle } from 'react-native-svg';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
} from 'expo-audio';

// ─── Circular progress scanning overlay ───────────────────────────
function ScanningOverlay() {
  const { workflowState, scanningProgress } = useWorkflowStore();

  if (workflowState !== 'SCANNING') return null;

  const radius = 90;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (scanningProgress / 100) * circumference;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.scanningOverlayContainer}>
        <BlurView intensity={25} tint="dark" style={styles.scanningOverlayBlur}>
          <View style={styles.progressCircleContainer}>
            <Svg height={radius * 2} width={radius * 2} style={styles.svgRotate}>
              {/* Background Gray Ring */}
              <Circle
                stroke="rgba(255,255,255,0.08)"
                fill="transparent"
                strokeWidth={stroke}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
              {/* Foreground Green Progress Ring */}
              <Circle
                stroke="#10B981"
                fill="transparent"
                strokeWidth={stroke}
                strokeDasharray={circumference + ' ' + circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
            </Svg>
            <View style={styles.progressTextContainer}>
              <Text style={styles.progressPercent}>{scanningProgress}%</Text>
              <Text style={styles.progressText}>Analyzing</Text>
            </View>
          </View>
          <Text style={styles.steadyText}>Keep camera steady for best results</Text>
        </BlurView>
      </View>
    </View>
  );
}

export default function CameraScreen() {
  const connect = useWsStore((s) => s.connect);
  const disconnect = useWsStore((s) => s.disconnect);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, []);

  // Lifted Audio Recorders to prevent native crashes on component unmount
  const sheetAudioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const sheetRecorderState = useAudioRecorderState(sheetAudioRecorder);
  const [sheetIsTranscribing, setSheetIsTranscribing] = React.useState(false);

  const askAudioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const askRecorderState = useAudioRecorderState(askAudioRecorder);
  const [askIsTranscribing, setAskIsTranscribing] = React.useState(false);

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        <CameraView />
        <AROverlay />
        <StatusCapsule />
        <LeftControls />
        <ScanningOverlay />
        <HazardSheet
          audioRecorder={sheetAudioRecorder}
          recorderState={sheetRecorderState}
          isTranscribing={sheetIsTranscribing}
          setIsTranscribing={setSheetIsTranscribing}
        />
        <AskAIButton
          audioRecorder={askAudioRecorder}
          recorderState={askRecorderState}
          isTranscribing={askIsTranscribing}
          setIsTranscribing={setAskIsTranscribing}
        />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  // Scanning Overlay
  scanningOverlayContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningOverlayBlur: {
    padding: 30,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 18, 25, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  progressCircleContainer: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svgRotate: {
    transform: [{ rotate: '-90deg' }],
  },
  progressTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressPercent: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  steadyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginTop: 18,
    textAlign: 'center',
  },
});
