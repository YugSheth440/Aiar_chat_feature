import React, { useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import BottomSheetGorhom, {
  BottomSheetScrollView,
  TouchableOpacity,
} from '@gorhom/bottom-sheet';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  CheckCircle,
  Star,
  Compass,
  Info,
  Mic,
  X,
  Volume2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Square,
} from 'lucide-react-native';
import { useWorkflowStore, ActiveModeType } from '../../store/workflowStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import { BACKEND_URL } from '../../src/config';
import { ActivityIndicator } from 'react-native';
import { GeminiAssistantBar } from '../ui/AskAIButton';

// ─── Glass Background ─────────────────────────────────────────────
const CustomBackground = ({ style }: any) => (
  <View style={[style, { overflow: 'hidden', borderTopLeftRadius: 28, borderTopRightRadius: 28 }]}>
    <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15,18,25,0.6)' }]} />
  </View>
);

// ─── Soundwave/Pulsing Visualizer for Voice Assistant ─────────────
function SoundwaveBar({ color }: { color: string }) {
  const scaleYVal = useSharedValue(0.25);
  useEffect(() => {
    scaleYVal.value = withRepeat(
      withSequence(
        withTiming(0.4 + Math.random() * 0.6, { duration: 300 + Math.random() * 200 }),
        withTiming(0.25, { duration: 300 + Math.random() * 200 })
      ),
      -1,
      true
    );
  }, []);
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scaleYVal.value }],
  }));
  return (
    <Animated.View
      style={[styles.soundwaveBar, { backgroundColor: color, height: 35 }, barStyle]}
    />
  );
}

function SoundwaveVisualizer({ count = 9, isMulticolor = false, defaultColor = '#10B981' }) {
  const geminiColors = ['#4285F4', '#5C6BC0', '#7E57C2', '#AB47BC', '#EC407A', '#AB47BC', '#7E57C2', '#5C6BC0', '#4285F4'];
  return (
    <View style={styles.soundwaveRow}>
      {Array.from({ length: count }).map((_, i) => {
        const barColor = isMulticolor ? geminiColors[i % geminiColors.length] : defaultColor;
        return <SoundwaveBar key={i} color={barColor} />;
      })}
    </View>
  );
}

// ─── Bottom Sheet Contents ────────────────────────────────────────
interface SheetBodyProps {
  audioRecorder: any;
  recorderState: any;
  isTranscribing: boolean;
  setIsTranscribing: (val: boolean) => void;
}

function SheetBody({
  audioRecorder,
  recorderState,
  isTranscribing,
  setIsTranscribing,
}: SheetBodyProps) {
  const {
    workflowState,
    deviceName,
    deviceConfidence,
    deviceDescription,
    components,
    activeComponentIndex,
    activeStepIndex,
    guideSteps,
    voiceResponseText,
    voiceSolutions,
    confirmDevice,
    selectMode,
    nextComponent,
    prevComponent,
    nextStep,
    prevStep,
    setWorkflowState,
    setVoiceSpeakingState,
    setVoiceActiveState,
    reset,
    runRealScan,
    setActiveComponentIndex,
    activeMode,
    likelyIssue,
    troubleshootSummary,
    troubleshootCauses,
    troubleshootActions,
  } = useWorkflowStore();

  const [selectedVoice, setSelectedVoice] = React.useState<string | undefined>(undefined);

  useEffect(() => {
    async function loadVoices() {
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        const premiumVoice = voices.find(
          (v: Speech.Voice) => v.language.startsWith('en') && v.quality === Speech.VoiceQuality.Enhanced
        ) || voices.find((v: Speech.Voice) => v.language.startsWith('en'));

        if (premiumVoice) {
          setSelectedVoice(premiumVoice.identifier);
        }
      } catch (err) {
        console.error('[Voice] Failed to load speech voices:', err);
      }
    }
    loadVoices();
  }, []);


  useEffect(() => {
    if (workflowState === 'EXPLORE_LABELS' && components[activeComponentIndex]) {
      const activePart = components[activeComponentIndex];
      Speech.stop();
      Speech.speak(`${activePart.label}. ${activePart.description}`, {
        rate: 0.95,
      });
    }
  }, [activeComponentIndex, workflowState]);

  useEffect(() => {
    if (workflowState === 'GUIDE_MODE' && guideSteps[activeStepIndex]) {
      const currentStep = guideSteps[activeStepIndex];
      Speech.stop();
      Speech.speak(`Step ${activeStepIndex + 1}. ${currentStep.title}. ${currentStep.description}`, {
        rate: 0.95,
      });
    }
  }, [activeStepIndex, workflowState]);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const handleModeSelect = async (mode: ActiveModeType) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    selectMode(mode);
  };

  switch (workflowState) {
    case 'IDENTIFIED':
      return (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.contentContainer}>
          <Text style={styles.deviceNameText}>{deviceName}</Text>
          <Text style={styles.confidenceText}>{deviceConfidence}% Confidence</Text>
          <Text style={styles.descText}>{deviceDescription}</Text>
          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => confirmDevice(false)}
              style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
            >
              <Text style={styles.btnSecondaryText}>No, not this</Text>
            </Pressable>
            <Pressable
              onPress={() => confirmDevice(true)}
              style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
            >
              <Text style={styles.btnPrimaryText}>Yes, correct</Text>
            </Pressable>
          </View>
        </Animated.View>
      );

    case 'MODE_SELECTION':
      return (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.contentContainer}>
          <View style={styles.pillLabelRow}>
            <View style={styles.pillLabel}>
              <Text style={styles.pillLabelText}>{deviceName} • {deviceConfidence}% Confidence</Text>
            </View>
          </View>
          <Text style={styles.titleText}>What would you like to do?</Text>
          <Text style={styles.subtitleText}>Choose a mode to continue</Text>

          <View style={styles.modeOptions}>
            <Pressable
              onPress={() => handleModeSelect('troubleshoot')}
              style={({ pressed }) => [styles.modeCard, { borderColor: 'rgba(239,68,68,0.2)' }, pressed && styles.pressed]}
            >
              <View style={[styles.modeIconContainer, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                <Star color="#EF4444" size={20} fill="#EF4444" />
              </View>
              <View style={styles.modeTextContainer}>
                <Text style={[styles.modeCardTitle, { color: '#EF4444' }]}>Troubleshoot</Text>
                <Text style={styles.modeCardDesc}>Find and diagnose issues</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => handleModeSelect('guide')}
              style={({ pressed }) => [styles.modeCard, { borderColor: 'rgba(16,185,129,0.2)' }, pressed && styles.pressed]}
            >
              <View style={[styles.modeIconContainer, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                <Compass color="#10B981" size={20} />
              </View>
              <View style={styles.modeTextContainer}>
                <Text style={[styles.modeCardTitle, { color: '#10B981' }]}>Guide</Text>
                <Text style={styles.modeCardDesc}>Get step-by-step guidance</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => handleModeSelect('explain')}
              style={({ pressed }) => [styles.modeCard, { borderColor: 'rgba(59,130,246,0.2)' }, pressed && styles.pressed]}
            >
              <View style={[styles.modeIconContainer, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                <Info color="#3B82F6" size={20} />
              </View>
              <View style={styles.modeTextContainer}>
                <Text style={[styles.modeCardTitle, { color: '#3B82F6' }]}>Explain</Text>
                <Text style={styles.modeCardDesc}>Learn about components</Text>
              </View>
            </Pressable>
          </View>
        </Animated.View>
      );

    case 'EXPLORE_LABELS': {
      const activePart = components[activeComponentIndex];
      const isTroubleshoot = activeMode === 'troubleshoot';

      const isNoIssue = isTroubleshoot && likelyIssue && (
        likelyIssue.toLowerCase().includes('none') ||
        likelyIssue.toLowerCase().includes('no issue') ||
        likelyIssue.toLowerCase().includes('normal') ||
        likelyIssue.toLowerCase().includes('allright') ||
        likelyIssue.toLowerCase().includes('operational') ||
        likelyIssue.toLowerCase().includes('clear') ||
        likelyIssue.toLowerCase().includes('no anomaly')
      );

      const cardBorderColor = isNoIssue ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.22)';
      const cardBgColor = isNoIssue ? 'rgba(16,185,129,0.06)' : 'rgba(239, 68, 68, 0.08)';
      const titleColor = isNoIssue ? '#10B981' : '#EF4444';
      const HeaderIcon = isNoIssue ? CheckCircle : Sparkles;

      return (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.contentContainer}>
          {!isTroubleshoot && (
            <>
              <View style={styles.detailsHeader}>
                <Text style={styles.detailsPartTitle}>{activePart?.label}</Text>
                <Text style={styles.indexIndicator}>{activeComponentIndex + 1} / {components.length}</Text>
              </View>
              <Text style={styles.detailsDesc}>{activePart?.description}</Text>
            </>
          )}

          {isTroubleshoot && likelyIssue && (
            <View style={[styles.troubleshootSection, { borderColor: cardBorderColor, backgroundColor: cardBgColor }]}>
              <View style={styles.troubleshootHeader}>
                <HeaderIcon color={titleColor} size={16} />
                <Text style={[styles.troubleshootTitle, { color: titleColor }]}>
                  {isNoIssue ? 'Status Summary' : 'Troubleshooting Diagnosis'}
                </Text>
              </View>
              <Text style={styles.troubleshootIssue}>
                {isNoIssue ? 'Status: Normal / No Issues' : `Suspected Issue: ${likelyIssue}`}
              </Text>
              {troubleshootSummary ? <Text style={styles.troubleshootSummary}>{troubleshootSummary}</Text> : null}
              
              {troubleshootCauses && troubleshootCauses.length > 0 && !isNoIssue && (
                <View style={styles.troubleshootGroup}>
                  <Text style={styles.troubleshootSubheading}>Possible Causes:</Text>
                  {troubleshootCauses.map((cause, idx) => (
                    <Text key={idx} style={styles.troubleshootBullet}>• {cause}</Text>
                  ))}
                </View>
              )}

              {troubleshootActions && troubleshootActions.length > 0 && (
                <View style={styles.troubleshootGroup}>
                  <Text style={styles.troubleshootSubheading}>
                    {isNoIssue ? 'Maintenance/Inspection Tips:' : 'Recommended Actions:'}
                  </Text>
                  {troubleshootActions.map((act, idx) => (
                    <Text key={idx} style={styles.troubleshootBullet}>• {act}</Text>
                  ))}
                </View>
              )}

              {/* Mic button below the text block */}
              <View style={styles.troubleshootMicRow}>
                <Pressable
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setVoiceActiveState(true);
                  }}
                  style={({ pressed }) => [
                    styles.troubleshootMicBtn,
                    { backgroundColor: isNoIssue ? '#10B981' : '#EF4444', shadowColor: isNoIssue ? '#10B981' : '#EF4444' },
                    pressed && styles.pressed
                  ]}
                >
                  <Mic color="#fff" size={15} strokeWidth={2.5} />
                  <Text style={styles.troubleshootMicBtnText}>Ask Voice Assistant</Text>
                </Pressable>
              </View>
            </View>
          )}

          {!isTroubleshoot && (
            <>
              <View style={styles.statusDivider} />

              <View style={styles.detailsFooter}>
                <View style={styles.statusBadge}>
                  <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.statusText}>Current Status: {activePart?.status}</Text>
                </View>

                <View style={styles.arrowControls}>
                  <TouchableOpacity
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      prevComponent();
                    }}
                    style={styles.controlArrowBtn}
                    activeOpacity={0.7}
                  >
                    <ArrowLeft color="#fff" size={16} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      nextComponent();
                    }}
                    style={styles.controlArrowBtn}
                    activeOpacity={0.7}
                  >
                    <ArrowRight color="#fff" size={16} />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          <View style={[styles.buttonRow, { marginTop: 20 }]}>
            <Pressable
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                runRealScan();
              }}
              style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed, { flex: 1 }]}
            >
              <Text style={styles.btnSecondaryText}>That's not correct (Re-scan)</Text>
            </Pressable>
          </View>
        </Animated.View>
      );
    }

    case 'VOICE_ACTIVE':
    case 'VOICE_SPEAKING':
      return (
        <GeminiAssistantBar
          audioRecorder={audioRecorder}
          recorderState={recorderState}
          isTranscribing={isTranscribing}
          setIsTranscribing={setIsTranscribing}
        />
      );

    case 'GUIDE_MODE': {
      const currentStep = guideSteps[activeStepIndex];
      return (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.contentContainer}>
          <View style={styles.detailsHeader}>
            <Text style={styles.detailsPartTitle}>Step {activeStepIndex + 1} of {guideSteps.length}</Text>
            <Text style={styles.indexIndicator}>{activeStepIndex + 1} / {guideSteps.length}</Text>
          </View>
          
          <Text style={styles.guideStepTitle}>{currentStep?.title}</Text>
          <Text style={styles.detailsDesc}>{currentStep?.description}</Text>
          
          <View style={styles.statusDivider} />

          <View style={styles.buttonRow}>
            <Pressable
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                prevStep();
              }}
              style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed, activeStepIndex === 0 && { opacity: 0.4 }]}
              disabled={activeStepIndex === 0}
            >
              <Text style={styles.btnSecondaryText}>Back</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                nextStep();
              }}
              style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
            >
              <Text style={styles.btnPrimaryText}>Next</Text>
            </Pressable>
          </View>
        </Animated.View>
      );
    }

    case 'COMPLETED':
      return (
        <Animated.View entering={FadeIn} style={styles.contentContainer}>
          <View style={[styles.checkCircle, { alignSelf: 'center', width: 48, height: 48, borderRadius: 24, backgroundColor: '#10B981', marginBottom: 12 }]}>
            <CheckCircle color="#fff" size={24} />
          </View>
          <Text style={[styles.deviceNameText, { textAlign: 'center' }]}>Task Completed</Text>
          <Text style={[styles.descText, { textAlign: 'center', marginBottom: 20 }]}>
            All guided steps for the AC Induction Motor have been completed.
          </Text>
          <Pressable
            onPress={reset}
            style={({ pressed }) => [styles.btnPrimary, { width: '100%' }, pressed && styles.pressed]}
          >
            <Text style={styles.btnPrimaryText}>Done & Reset</Text>
          </Pressable>
        </Animated.View>
      );

    default:
      return null;
  }
}

interface HazardSheetProps {
  audioRecorder: any;
  recorderState: any;
  isTranscribing: boolean;
  setIsTranscribing: (val: boolean) => void;
}

export function HazardSheet({
  audioRecorder,
  recorderState,
  isTranscribing,
  setIsTranscribing,
}: HazardSheetProps) {
  const { workflowState } = useWorkflowStore();
  const sheetRef = useRef<BottomSheetGorhom>(null);

  const isVisible = workflowState !== 'READY' &&
                    workflowState !== 'SCANNING';
  const snapPoints = ['10%', '35%', '85%'];

  useEffect(() => {
    if (isVisible) {
      if (workflowState === 'VOICE_ACTIVE' || workflowState === 'VOICE_SPEAKING') {
        sheetRef.current?.snapToIndex(2);
      } else {
        sheetRef.current?.snapToIndex(1);
      }
    } else {
      sheetRef.current?.close();
    }
  }, [isVisible, workflowState]);

  return (
    <BottomSheetGorhom
      ref={sheetRef}
      index={isVisible ? 1 : -1}
      snapPoints={snapPoints}
      backgroundComponent={CustomBackground}
      handleIndicatorStyle={styles.handle}
      style={styles.sheet}
      enablePanDownToClose={false}
    >
      <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
        <SheetBody
          audioRecorder={audioRecorder}
          recorderState={recorderState}
          isTranscribing={isTranscribing}
          setIsTranscribing={setIsTranscribing}
        />
      </BottomSheetScrollView>
    </BottomSheetGorhom>
  );
}

const styles = StyleSheet.create({
  sheet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.65,
    shadowRadius: 28,
    elevation: 28,
    zIndex: 1000,
  },
  handle: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 40,
  },
  contentContainer: {
    paddingVertical: 12,
  },
  deviceNameText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34D399',
    marginBottom: 12,
  },
  descText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
  pillLabelRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  pillLabel: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pillLabelText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  titleText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  subtitleText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 20,
  },
  modeOptions: {
    gap: 12,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  modeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTextContainer: {
    flex: 1,
  },
  modeCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  modeCardDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailsPartTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  indexIndicator: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
  },
  detailsDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
    marginBottom: 16,
  },
  statusDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  detailsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  arrowControls: {
    flexDirection: 'row',
    gap: 8,
  },
  controlArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Voice UI
  voiceWrapper: {
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  voiceClose: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundwaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    marginTop: 8,
    marginBottom: 12,
  },
  soundwaveBar: {
    width: 4,
    borderRadius: 2,
  },
  voiceHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  voiceBigText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  voiceSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 24,
  },
  micCircleButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  responseScroll: {
    width: '100%',
    maxHeight: 280,
  },
  responseContent: {
    paddingBottom: 16,
  },
  responseText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 22,
    marginBottom: 16,
  },
  actionList: {
    gap: 10,
    marginBottom: 20,
  },
  actionBullet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBulletText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  showARBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    width: '100%',
  },
  showARBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  guideStepTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  checkCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  troubleshootSection: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.22)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginVertical: 12,
    gap: 8,
  },
  troubleshootHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  troubleshootTitle: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  troubleshootIssue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  troubleshootSummary: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    lineHeight: 18,
  },
  troubleshootGroup: {
    marginTop: 6,
    gap: 4,
  },
  troubleshootSubheading: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  troubleshootBullet: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: 4,
  },
  troubleshootMicRow: {
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  troubleshootMicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  troubleshootMicBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  voiceActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    width: '100%',
  },
  voiceActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
  },
});
