import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { RotateCcw, ChevronLeft, ScanFace, Check, Sun } from 'lucide-react-native';
import { useWorkflowStore } from '../../store/workflowStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function StatusCapsule() {
  const {
    workflowState,
    deviceName,
    deviceConfidence,
    components,
    activeComponentIndex,
    activeStepIndex,
    guideSteps,
    reset,
    setWorkflowState,
    selectMode,
  } = useWorkflowStore();
  const insets = useSafeAreaInsets();

  const pulseScale = useSharedValue(1);
  const pulseOp = useSharedValue(0.4);

  const isAnalyzing = workflowState === 'SCANNING';

  useEffect(() => {
    if (isAnalyzing) {
      pulseScale.value = withRepeat(withTiming(2, { duration: 800 }), -1);
      pulseOp.value = withRepeat(
        withSequence(withTiming(0.6, { duration: 100 }), withTiming(0, { duration: 700 })),
        -1
      );
    } else {
      pulseScale.value = 1;
      pulseOp.value = 0;
    }
  }, [isAnalyzing]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOp.value,
  }));

  const handleBack = () => {
    if (workflowState === 'SCANNING' || workflowState === 'READY') {
      reset();
    } else if (workflowState === 'IDENTIFIED') {
      setWorkflowState('READY');
    } else if (workflowState === 'MODE_SELECTION') {
      setWorkflowState('IDENTIFIED');
    } else if (workflowState === 'EXPLORE_LABELS') {
      setWorkflowState('MODE_SELECTION');
    } else if (workflowState === 'GUIDE_MODE') {
      setWorkflowState('MODE_SELECTION');
    } else if (workflowState === 'VOICE_ACTIVE' || workflowState === 'VOICE_SPEAKING') {
      setWorkflowState('MODE_SELECTION');
    } else {
      reset();
    }
  };

  const renderContent = () => {
    switch (workflowState) {
      case 'READY':
        return (
          <View style={styles.capsule}>
            <View style={styles.dotWrap}>
              <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
            </View>
            <Text style={styles.label}>Ready</Text>
            <View style={styles.iconBtn}>
              <Sun color="rgba(255,255,255,0.7)" size={14} />
            </View>
          </View>
        );

      case 'SCANNING':
        return (
          <View style={styles.capsule}>
            <View style={styles.dotWrap}>
              <Animated.View style={[styles.dotPulse, { backgroundColor: '#10B981' }, pulseStyle]} />
              <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
            </View>
            <Text style={styles.label}>Analyzing...</Text>
            <View style={styles.iconBtn}>
              <Sun color="rgba(255,255,255,0.7)" size={14} />
            </View>
          </View>
        );

      case 'IDENTIFIED':
        return (
          <View style={[styles.capsule, { borderColor: 'rgba(16,185,129,0.3)' }]}>
            <View style={[styles.checkCircle, { backgroundColor: '#10B981' }]}>
              <Check color="#fff" size={10} strokeWidth={3} />
            </View>
            <Text style={styles.label}>Identified</Text>
          </View>
        );

      case 'MODE_SELECTION':
        return (
          <View style={styles.capsule}>
            <Text style={styles.label}>{deviceName}</Text>
            <View style={styles.confBadge}>
              <Text style={styles.confText}>{deviceConfidence}% Confidence</Text>
            </View>
          </View>
        );

      case 'EXPLORE_LABELS': {
        const activePart = components[activeComponentIndex];
        return (
          <View style={styles.exploreWrapper}>
            {/* Top Left Back Button */}
            <Pressable onPress={handleBack} style={styles.roundBtn}>
              <ChevronLeft color="#fff" size={20} />
            </Pressable>

            {/* Center active part tag if any */}
            {activePart && (
              <View style={[styles.capsule, { borderColor: 'rgba(255,255,255,0.1)' }]}>
                <Text style={styles.label}>{activePart.label}</Text>
              </View>
            )}

            {/* Top Right AR Focus Toggle */}
            <Pressable onPress={() => {}} style={styles.roundBtn}>
              <ScanFace color="#fff" size={20} />
            </Pressable>
          </View>
        );
      }

      case 'GUIDE_MODE':
        return (
          <View style={styles.exploreWrapper}>
            <Pressable onPress={handleBack} style={styles.roundBtn}>
              <ChevronLeft color="#fff" size={20} />
            </Pressable>
            <View style={styles.capsule}>
              <Text style={styles.label}>Step {activeStepIndex + 1} of {guideSteps.length}</Text>
            </View>
            <Pressable onPress={() => {}} style={styles.roundBtn}>
              <ScanFace color="#fff" size={20} />
            </Pressable>
          </View>
        );

      case 'VOICE_ACTIVE':
      case 'VOICE_SPEAKING':
        return (
          <View style={styles.exploreWrapper}>
            <Pressable onPress={handleBack} style={styles.roundBtn}>
              <ChevronLeft color="#fff" size={20} />
            </Pressable>
            <View style={styles.capsule}>
              <Text style={styles.label}>
                {workflowState === 'VOICE_ACTIVE' ? 'Listening...' : 'Voice Assistant'}
              </Text>
            </View>
            <Pressable onPress={() => {}} style={styles.roundBtn}>
              <ScanFace color="#fff" size={20} />
            </Pressable>
          </View>
        );

      default:
        return (
          <View style={styles.capsule}>
            <Text style={styles.label}>{deviceName}</Text>
          </View>
        );
    }
  };

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[
        styles.wrapper,
        { top: Math.max(insets.top, 30) + 12 },
        (workflowState === 'EXPLORE_LABELS' ||
         workflowState === 'GUIDE_MODE' ||
         workflowState === 'VOICE_ACTIVE' ||
         workflowState === 'VOICE_SPEAKING') && { width: '90%', alignSelf: 'center' }
      ]}
    >
      <BlurView intensity={40} tint="dark" style={styles.blurWrap}>
        {renderContent()}
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 100,
  },
  blurWrap: {
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: 'rgba(15,18,25,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 8,
    gap: 8,
  },
  dotWrap: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPulse: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  checkCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  iconBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  confBadge: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  confText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34D399',
  },
  exploreWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 12,
  },
  roundBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

