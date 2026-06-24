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
  withSequence,
  withTiming,
  withSpring,
  FadeInLeft,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  RefreshCcw,
  Zap,
  Sun,
  LayoutGrid,
  ScanLine,
  Mic,
} from 'lucide-react-native';
import { useWorkflowStore } from '../../store/workflowStore';
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
function ScanBtn() {
  const { workflowState, runRealScan } = useWorkflowStore();

  const isAnalyzing = workflowState === 'SCANNING';

  // Emerald green accent colors as specified
  const bgColor = '#10B981';
  const glowColor = '#34D399';

  const pulseScale = useSharedValue(1);
  const glowOp = useSharedValue(0.35);

  useEffect(() => {
    if (isAnalyzing) {
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
      pulseScale.value = 1;
      glowOp.value = 0.35;
    }
  }, [isAnalyzing]);

  const btnScale = useSharedValue(1);
  const scanBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pulseScale.value, { damping: 10 }) }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOp.value,
  }));

  const handlePress = async () => {
    if (isAnalyzing) return;
    btnScale.value = withSequence(withTiming(0.88, { duration: 90 }), withSpring(1, { damping: 10 }));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    runRealScan();
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
          <ScanLine color="#fff" size={24} strokeWidth={2} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ── Main export ─────────────────────────────────────────────────
export function LeftControls() {
  const { facing, toggleFacing, toggleTorch, torchEnabled, workflowState, setVoiceActiveState } = useWorkflowStore();
  const insets = useSafeAreaInsets();

  // Hide left controls completely when sheet is expanded in details
  const isHidden = workflowState === 'EXPLORE_LABELS' || workflowState === 'GUIDE_MODE' || workflowState === 'VOICE_SPEAKING';
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(isHidden ? 0 : 1, { duration: 250 });
  }, [isHidden]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: withTiming(isHidden ? -50 : 0, { duration: 250 }) }],
  }));

  const triggerVoice = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setVoiceActiveState(true);
  };

  return (
    <Animated.View entering={FadeInLeft.delay(200).springify().damping(20)} style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[styles.container, { top: Math.max(insets.top, 30) + 60 }, containerStyle]}
        pointerEvents={isHidden ? 'none' : 'box-none'}
      >
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

        {/* ── Sun / Exposure ── */}
        <GlassBtn onPress={() => {}} size={48}>
          <Sun color="rgba(255,255,255,0.88)" size={19} strokeWidth={2.2} />
        </GlassBtn>

        {/* ── Grid/Layout Toggle ── */}
        <GlassBtn onPress={() => {}} size={48}>
          <LayoutGrid color="rgba(255,255,255,0.88)" size={19} strokeWidth={2.2} />
        </GlassBtn>

        {/* ── Voice Assistant Trigger ── */}
        <GlassBtn
          onPress={triggerVoice}
          size={48}
          tintColor="#EF4444"
          active={workflowState === 'VOICE_ACTIVE'}
        >
          <Mic color="rgba(255,255,255,0.88)" size={19} strokeWidth={2.2} />
        </GlassBtn>

        {/* ── Camera Flip ── */}
        <GlassBtn onPress={toggleFacing} size={48}>
          <RefreshCcw color="rgba(255,255,255,0.88)" size={19} strokeWidth={2.2} />
        </GlassBtn>

        {/* ── Separator ── */}
        <View style={styles.sep} />

        {/* ── Scan button ── */}
        <ScanBtn />
      </Animated.View>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 14,
  },
  scanHighlight: {
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
