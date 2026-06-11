import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  FadeInLeft,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  RefreshCcw,
  Smartphone,
  ScanLine,
  Zap,
} from 'lucide-react-native';
import { useWorkflowStore } from '../../store/workflowStore';
import { useSceneStore } from '../../store/sceneStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Premium iOS-style glass button ─────────────────────────────
function GlassBtn({
  onPress,
  children,
  size = 48,
  tintColor,
  active,
  disabled,
}: {
  onPress: () => void;
  children: React.ReactNode;
  size?: number;
  tintColor?: string;
  active?: boolean;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const pressOp = useSharedValue(1);

  const handlePress = async () => {
    if (disabled) return;
    scale.value = withSequence(
      withTiming(0.84, { duration: 90 }),
      withSpring(1, { damping: 10, stiffness: 280 })
    );
    pressOp.value = withSequence(withTiming(0.7, { duration: 90 }), withTiming(1, { duration: 120 }));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: pressOp.value,
  }));

  return (
    <Pressable onPress={handlePress} hitSlop={8}>
      <Animated.View style={[styles.btnWrap, { width: size, height: size, borderRadius: size / 2 }, animStyle]}>
        <BlurView
          intensity={85}
          tint="dark"
          style={[
            styles.btnBlur,
            { borderRadius: size / 2 },
            active && tintColor
              ? {
                  backgroundColor: `${tintColor}28`,
                  borderColor: `${tintColor}55`,
                }
              : {},
          ]}
        >
          {children}
        </BlurView>
      </Animated.View>
    </Pressable>
  );
}

// ── Premium Scan button ─────────────────────────────────────────
// In the new pipeline, detection is continuous and automatic via CameraView's
// useFrameProcessor. The scan button manually resets state so the processor
// can send the next stable frame to the backend.
function ScanBtn() {
  const { workflowState, reset: resetWorkflow } = useWorkflowStore();
  const { reset: resetScene, analysisStatus } = useSceneStore();

  const isAnalyzing = workflowState === 'ANALYZING' || analysisStatus === 'analyzing';

  const bgColor =
    workflowState === 'HAZARD_FOCUSED' || workflowState === 'SHEET_OPEN'
      ? '#d32f2f'
      : workflowState === 'HAZARDS_DISCOVERED'
      ? '#e65100'
      : '#1565c0';

  const glowColor =
    workflowState === 'HAZARD_FOCUSED' || workflowState === 'SHEET_OPEN'
      ? '#ef4444'
      : workflowState === 'HAZARDS_DISCOVERED'
      ? '#fb923c'
      : '#3b82f6';

  const pulseScale = useSharedValue(1);
  const glowOp = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (isAnalyzing) {
      rotation.value = withRepeat(withTiming(360, { duration: 1800 }), -1);
      pulseScale.value = withRepeat(
        withSequence(withTiming(1.1, { duration: 700 }), withTiming(1, { duration: 700 })),
        -1,
        true
      );
      glowOp.value = withRepeat(
        withSequence(withTiming(0.8, { duration: 700 }), withTiming(0.2, { duration: 700 })),
        -1,
        true
      );
    } else {
      rotation.value = withTiming(0, { duration: 400 });
      pulseScale.value = withSpring(1, { damping: 12 });
      glowOp.value = withTiming(0.35, { duration: 400 });
    }
  }, [isAnalyzing]);

  const btnScale = useSharedValue(1);
  const scanBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pulseScale.value, { damping: 10 }) }],
  }));
  const rotStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOp.value,
  }));

  const handlePress = async () => {
    if (isAnalyzing) return;
    btnScale.value = withSequence(withTiming(0.88, { duration: 90 }), withSpring(1, { damping: 10 }));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Force the CameraView worklet to capture and send the frame to the backend
    // The actual detection + WebSocket send happens automatically in CameraView
    // but this bypasses the tracking wait.
    resetScene();
    resetWorkflow();
    useWorkflowStore.getState().triggerManualScan();
  };

  return (
    <Pressable onPress={handlePress} disabled={isAnalyzing}>
      <Animated.View style={[styles.scanWrapper, scanBtnStyle]}>
        {/* Ambient glow ring */}
        <Animated.View
          style={[
            styles.scanGlow,
            { backgroundColor: glowColor, shadowColor: glowColor },
            glowStyle,
          ]}
          pointerEvents="none"
        />

        {/* Button body */}
        <View style={[styles.scanBody, { backgroundColor: bgColor }]}>
          {/* Inner highlight for depth */}
          <View style={styles.scanHighlight} />

          {/* Icon */}
          <Animated.View style={rotStyle}>
            {isAnalyzing ? (
              <ScanLine color="#fff" size={24} strokeWidth={2} />
            ) : (
              <ScanLine color="#fff" size={24} strokeWidth={2} />
            )}
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ── Screen rotate — uses expo-screen-orientation ──────────────────────
function RotateBtn() {
  const { setLandscape, isLandscape } = useWorkflowStore();

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newIsLandscape = !isLandscape;
    setLandscape(newIsLandscape);
    
    try {
      if (newIsLandscape) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    } catch (e) {
      console.warn('Rotation lock failed:', e);
    }
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(isLandscape ? '90deg' : '0deg', { duration: 300 }) }],
  }));

  return (
    <GlassBtn onPress={handlePress} size={48}>
      <Animated.View style={animStyle}>
        <Smartphone color="rgba(255,255,255,0.88)" size={19} strokeWidth={2.2} />
      </Animated.View>
    </GlassBtn>
  );
}

// ── Main export ─────────────────────────────────────────────────
export function LeftControls() {
  const { toggleFacing, toggleTorch, torchEnabled, sheetSnapIndex } = useWorkflowStore();
  const insets = useSafeAreaInsets();

  // Hide left controls completely when sheet is expanded (snap index >= 1)
  // to prevent overlapping the bottom panel card.
  const isHidden = sheetSnapIndex >= 1;
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(isHidden ? 0 : 1, { duration: 250 });
  }, [isHidden]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: withTiming(isHidden ? -50 : 0, { duration: 250 }) }],
  }));

  return (
    <Animated.View
      entering={FadeInLeft.delay(200).springify().damping(20)}
      style={[styles.container, { top: insets.top + 60 }, containerStyle]}
      pointerEvents={isHidden ? 'none' : 'box-none'}
    >
      {/* ── Camera flip ── */}
      <GlassBtn onPress={toggleFacing} size={48}>
        <RefreshCcw color="rgba(255,255,255,0.88)" size={19} strokeWidth={2.2} />
      </GlassBtn>

      {/* ── Flash / Torch ── */}
      <GlassBtn
        onPress={toggleTorch}
        size={48}
        tintColor="#fbbf24"
        active={torchEnabled}
      >
        <Zap
          color={torchEnabled ? '#fbbf24' : 'rgba(255,255,255,0.88)'}
          size={19}
          strokeWidth={2.2}
          fill={torchEnabled ? '#fbbf24' : 'none'}
        />
      </GlassBtn>

      {/* ── Screen rotate ── */}
      <RotateBtn />

      {/* ── Separator ── */}
      <View style={styles.sep} />

      {/* ── Scan button ── */}
      <ScanBtn />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    zIndex: 80,
    gap: 10,
    alignItems: 'center',
  },

  // ── Glass icon button ──
  btnWrap: {
    overflow: 'hidden',
    // Deep shadow for depth / lifted look
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  btnBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,28,32,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    // Inner top highlight for iOS glass look
    overflow: 'hidden',
  },

  // ── Scan button ──
  sep: {
    width: 30,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 2,
  },
  scanWrapper: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 12,
  },
  scanBody: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
    // Deep shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 14,
  },
  scanHighlight: {
    // Top specular highlight for glass/3D depth
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
});
