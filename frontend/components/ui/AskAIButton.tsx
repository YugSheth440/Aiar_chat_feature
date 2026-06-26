import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  Mic,
  X,
  Trash2,
  Keyboard,
  Sparkles,
  Send,
} from 'lucide-react-native';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useChatStore } from '../../store/chatStore';
import { useWorkflowStore } from '../../store/workflowStore';
import { useARTrackingStore } from '../../store/arTrackingStore';
import { BACKEND_URL } from '../../src/config';

// ── Animated soundwave components for recording state (Gemini UI) ──
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
      style={[styles.soundwaveBar, { backgroundColor: color, height: 28 }, barStyle]}
    />
  );
}

// Alternating gradient soundwave
function SoundwaveVisualizer({ defaultColor = '#3B82F6', count = 21 }) {
  const colors = ['#3B82F6', '#06B6D4', '#22D3EE', '#06B6D4', '#3B82F6'];
  return (
    <View style={styles.soundwaveRow}>
      {Array.from({ length: count }).map((_, i) => {
        const barColor = colors[i % colors.length];
        return <SoundwaveBar key={i} color={barColor} />;
      })}
    </View>
  );
}

// Concentric pulsing microphone circles -> now pulsing red stop button!
function PulsingMic({ onPress }: { onPress: () => void }) {
  const scale1 = useSharedValue(1);
  const scale2 = useSharedValue(1);

  useEffect(() => {
    scale1.value = withRepeat(
      withSequence(
        withTiming(1.35, { duration: 1200 }),
        withTiming(1, { duration: 1200 })
      ),
      -1,
      true
    );
    scale2.value = withRepeat(
      withSequence(
        withTiming(1.7, { duration: 1600 }),
        withTiming(1, { duration: 1600 })
      ),
      -1,
      true
    );
  }, []);

  const pulseStyle1 = useAnimatedStyle(() => ({
    transform: [{ scale: scale1.value }],
    opacity: 1 - (scale1.value - 1) / 0.35,
  }));

  const pulseStyle2 = useAnimatedStyle(() => ({
    transform: [{ scale: scale2.value }],
    opacity: 0.7 - (scale2.value - 1) / 0.7,
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.micCircleContainer}>
      <Animated.View style={[styles.pulseCircle, styles.pulseOuter, pulseStyle2, { borderColor: 'rgba(239, 68, 68, 0.25)' }]} />
      <Animated.View style={[styles.pulseCircle, styles.pulseInner, pulseStyle1, { borderColor: 'rgba(239, 68, 68, 0.45)' }]} />
      <View style={[styles.micMainCircle, { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: '#EF4444', borderWidth: 2 }]}>
        <View style={styles.stopInnerSquare} />
      </View>
    </TouchableOpacity>
  );
}

function HeaderWaveIcon() {
  return (
    <View style={styles.headerIconContainer}>
      <View style={[styles.headerIconBar, { height: 10 }]} />
      <View style={[styles.headerIconBar, { height: 16 }]} />
      <View style={[styles.headerIconBar, { height: 22 }]} />
      <View style={[styles.headerIconBar, { height: 16 }]} />
      <View style={[styles.headerIconBar, { height: 10 }]} />
    </View>
  );
}

interface GeminiAssistantBarProps {
  audioRecorder: any;
  recorderState: any;
  isTranscribing: boolean;
  setIsTranscribing: (val: boolean) => void;
}

export function GeminiAssistantBar({
  audioRecorder,
  recorderState,
  isTranscribing,
  setIsTranscribing,
}: GeminiAssistantBarProps) {
  const workflowState = useWorkflowStore((s) => s.workflowState);
  const setWorkflowState = useWorkflowStore((s) => s.setWorkflowState);
  const cameraRef = useWorkflowStore((s) => s.cameraRef);

  const { messages, addUserMessage } = useChatStore();
  const [inputText, setInputText] = useState('');
  const [assistantState, setAssistantState] = useState<'LISTENING' | 'STOPPED' | 'TYPING'>('LISTENING');
  const inputRef = useRef<TextInput>(null);

  const isRecording = recorderState.isRecording;

  // Auto-start recording when user enters VOICE_ACTIVE state
  useEffect(() => {
    if (workflowState === 'VOICE_ACTIVE') {
      setAssistantState('LISTENING');
      startRecording();
    } else if (workflowState === 'VOICE_SPEAKING') {
      setAssistantState('STOPPED');
    }

    return () => {
      // Safe cleanup of active native audio session when component unmounts or state changes
      audioRecorder.stop().catch((e: any) => {
        console.log('[Voice] Safe unmount stop ignored:', e.message);
      });
    };
  }, [workflowState]);

  const startRecording = async () => {
    try {
      const permission = await getRecordingPermissionsAsync();
      if (!permission.granted) {
        const request = await requestRecordingPermissionsAsync();
        if (!request.granted) {
          alert('Microphone permission is required to record audio.');
          setWorkflowState('MODE_SELECTION');
          return;
        }
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      // Ensure any previous session is stopped first
      try {
        await audioRecorder.stop();
      } catch (stopErr) {}

      // Wrap prepare to catch "already prepared" exceptions safely
      try {
        await audioRecorder.prepareToRecordAsync();
      } catch (prepErr: any) {
        console.log('[Voice] prepareToRecordAsync bypassed:', prepErr.message);
      }

      // Record with safety and retry recovery
      try {
        await audioRecorder.record();
      } catch (recErr: any) {
        console.log('[Voice] record() failed, attempting recovery...', recErr.message);
        try {
          try {
            await audioRecorder.stop();
          } catch (e) {}
          try {
            await audioRecorder.prepareToRecordAsync();
          } catch (prepRetryErr: any) {
            console.log('[Voice] prepare retry bypassed:', prepRetryErr.message);
          }
          await audioRecorder.record();
        } catch (retryErr: any) {
          console.error('[Voice] Recovery record failed:', retryErr);
        }
      }
    } catch (err: any) {
      console.error('[Voice] Failed to start recording:', err);
    }
  };

  const handleStopRecording = async () => {
    if (isTranscribing) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Wrap stop to catch any native exceptions safely
      try {
        await audioRecorder.stop();
      } catch (stopErr: any) {
        console.log('[Voice] stop failed (already stopped):', stopErr.message);
      }
      
      const uri = audioRecorder.uri;
      if (!uri) {
        console.error('No recording URI found');
        return;
      }

      setIsTranscribing(true);

      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        name: 'audio.m4a',
        type: 'audio/m4a',
      } as any);

      const response = await fetch(`${BACKEND_URL}/transcribe`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      if (data.text && data.text.trim()) {
        handleQuerySubmit(data.text);
      } else {
        setAssistantState('LISTENING');
        startRecording();
      }
    } catch (err) {
      console.error('Failed to stop or transcribe recording:', err);
      setAssistantState('LISTENING');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleQuerySubmit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    Speech.stop();
    setInputText('');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Clear previous speaking state to prevent speaking old answers
    useWorkflowStore.getState().setVoiceSpeakingState('');

    addUserMessage(trimmed);
    useChatStore.getState().setTyping(true);

    // Transition to speaking state to show response text bubble
    setWorkflowState('VOICE_SPEAKING');
    setAssistantState('STOPPED');

    try {
      if (!cameraRef) {
        useChatStore.getState().setTyping(false);
        return;
      }
      const photo = await cameraRef.takePhoto({ flash: 'off' });
      const response = await fetch(`file://${photo.path}`);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const b64 = (reader.result as string).split(',')[1];
        
        try {
          const res = await fetch(`${BACKEND_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              full_frame_b64: b64,
              user_message: trimmed,
              session_id: 'default',
              conversation_history: [], // Do not send previous answers back to keep responses fresh and independent
              device_context: { lighting: 'normal', motion: 'low', device_mode: 'chat_gemini' }
            })
          });

          if (!res.ok) throw new Error('HTTP request failed');
          const data = await res.json();
          
          if (data.spatial_targets?.length > 0) {
            useARTrackingStore.getState().initFromVLM(data.spatial_targets);
          }
          if (data.chat_focus_target_id) {
            useARTrackingStore.getState().setChatFocusTarget(data.chat_focus_target_id);
          }
          const chatReply = data.chat_reply || data.summary || 'No response received.';
          useWorkflowStore.getState().setVoiceSpeakingState(chatReply, data.general_solutions || []);
          useChatStore.getState().addAssistantMessage(chatReply, data.chat_focus_target_id ?? null);
          useChatStore.getState().setTyping(false);

          // Auto-highlight focus component in workflow store if returned
          if (data.chat_focus_target_id) {
            const workflowStore = useWorkflowStore.getState();
            const targetIdx = workflowStore.components.findIndex((c) => c.id === data.chat_focus_target_id);
            if (targetIdx !== -1) {
              workflowStore.setActiveComponentIndex(targetIdx);
            }
          }
        } catch (postError) {
          console.error('[AskAI] HTTP POST failed:', postError);
          useChatStore.getState().setTyping(false);
        }
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error('[AskAI] Failed to capture frame:', e);
      useChatStore.getState().setTyping(false);
    }
  };

  const handleClose = () => {
    Speech.stop();
    setWorkflowState('MODE_SELECTION');
  };

  const handleDiscard = async () => {
    Speech.stop();
    setInputText('');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWorkflowState('VOICE_ACTIVE');
    setAssistantState('LISTENING');
    if (!isRecording) {
      startRecording();
    }
  };

  const handleStartAgain = async () => {
    Speech.stop();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setWorkflowState('VOICE_ACTIVE');
    setAssistantState('LISTENING');
    if (!isRecording) {
      startRecording();
    }
  };

  const formatTime = (timestamp?: number) => {
    const date = timestamp ? new Date(timestamp) : new Date();
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
  };

  const isActive = workflowState === 'VOICE_ACTIVE' || workflowState === 'VOICE_SPEAKING';
  if (!isActive) return null;

  // Retrieve last user query
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  const lastQueryContent = lastUserMessage?.content || "Show me how to replace the pressure valve.";
  const lastQueryTime = formatTime(lastUserMessage?.timestamp);

  return (
    <View style={styles.keyboardContainer}>
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(250)}
        style={styles.modalCard}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <HeaderWaveIcon />
            <View>
              <Text style={styles.headerTitle}>FixSight AR</Text>
              <Text style={styles.headerSubtitle}>Voice Assistant</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X color="#FFFFFF" size={16} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* ── Central Content Area ── */}
        {isTranscribing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Transcribing audio...</Text>
          </View>
        ) : assistantState === 'LISTENING' ? (
          /* State 1: LISTENING */
          <View style={styles.listeningContainer}>
            <PulsingMic onPress={handleStopRecording} />

            <View style={styles.soundwaveWrapper}>
              <SoundwaveVisualizer count={23} />
            </View>

            <Text style={styles.listeningText}>Listening...</Text>
            <Text style={styles.subListeningText}>Tap to stop</Text>
          </View>
        ) : assistantState === 'STOPPED' ? (
          /* State 2: STOPPED */
          <View style={styles.stoppedContainer}>
            <View style={styles.grayMicCircle}>
              <Mic color="rgba(255,255,255,0.3)" size={28} />
            </View>

            <Text style={styles.stoppedText}>Listening stopped</Text>
            <Text style={styles.subStoppedText}>You can review or start a new query.</Text>

            {/* Last Query Card */}
            <View style={styles.lastQueryCard}>
              <Text style={styles.quoteIcon}>“</Text>
              <Text style={styles.lastQueryText}>{lastQueryContent}</Text>
              <Text style={styles.lastQueryTime}>{lastQueryTime}</Text>
            </View>

            {/* Actions Row */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                onPress={handleDiscard}
                style={styles.discardBtn}
                activeOpacity={0.7}
              >
                <Trash2 color="#EF4444" size={16} style={{ marginRight: 6 }} />
                <Text style={styles.discardBtnText}>Discard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleStartAgain}
                style={styles.startAgainBtn}
                activeOpacity={0.8}
              >
                <Mic color="#FFFFFF" size={16} style={{ marginRight: 6 }} />
                <Text style={styles.startAgainBtnText}>Start again</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* State 3: TYPING */
          <View style={styles.typingContainer}>
            <View style={styles.typingInputWrapper}>
              <TextInput
                ref={inputRef}
                style={styles.typingTextInput}
                placeholder="Ask query or something else..."
                placeholderTextColor="rgba(255,255,255,0.38)"
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={() => handleQuerySubmit(inputText)}
                returnKeyType="send"
                multiline={false}
                maxLength={200}
                autoFocus
              />
              <TouchableOpacity
                onPress={() => handleQuerySubmit(inputText)}
                disabled={!inputText.trim()}
                style={[styles.typingSendBtn, !inputText.trim() && styles.typingSendBtnDisabled]}
                activeOpacity={0.8}
              >
                <Send color="#FFFFFF" size={16} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Sparkles color="rgba(59, 130, 246, 0.45)" size={14} style={{ marginRight: 6 }} />
            <Text style={styles.footerText}>Powered by AI</Text>
          </View>

          {assistantState === 'TYPING' ? (
            <TouchableOpacity
              onPress={() => setAssistantState('LISTENING')}
              style={styles.footerRight}
              activeOpacity={0.7}
            >
              <Text style={styles.footerLinkText}>Tap to speak</Text>
              <Mic color="rgba(255,255,255,0.4)" size={15} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => {
                setAssistantState('TYPING');
                setTimeout(() => inputRef.current?.focus(), 150);
              }}
              style={styles.footerRight}
              activeOpacity={0.7}
            >
              <Text style={styles.footerLinkText}>Tap to type</Text>
              <Keyboard color="rgba(255,255,255,0.4)" size={15} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    width: '100%',
  },
  modalCard: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 4,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.45)',
    fontWeight: '500',
    marginTop: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2.5,
    marginRight: 12,
  },
  headerIconBar: {
    width: 3,
    backgroundColor: '#3B82F6',
    borderRadius: 1.5,
  },

  // State: Loading
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500',
  },

  // State: Listening
  listeningContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  micCircleContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pulseCircle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.5,
  },
  pulseInner: {
    width: 90,
    height: 90,
  },
  pulseOuter: {
    width: 116,
    height: 116,
    borderStyle: 'dashed',
  },
  micMainCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  soundwaveWrapper: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  soundwaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  soundwaveBar: {
    width: 3,
    borderRadius: 1.5,
  },
  listeningText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#60A5FA',
  },
  subListeningText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 4,
    marginBottom: 20,
  },
  stopRecordingBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2.5,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stopInnerSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  stopBtnLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '500',
  },

  // State: Stopped
  stoppedContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  grayMicCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  stoppedText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  subStoppedText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 4,
    marginBottom: 18,
    textAlign: 'center',
  },
  lastQueryCard: {
    width: '100%',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    position: 'relative',
  },
  quoteIcon: {
    position: 'absolute',
    top: 8,
    left: 12,
    fontSize: 24,
    color: 'rgba(59, 130, 246, 0.45)',
    fontWeight: 'bold',
  },
  lastQueryText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 20,
    paddingLeft: 16,
    paddingRight: 8,
    fontWeight: '500',
  },
  lastQueryTime: {
    alignSelf: 'flex-end',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.3)',
    marginTop: 8,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  discardBtn: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderRadius: 14,
    paddingVertical: 12,
  },
  discardBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  startAgainBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  startAgainBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // State: Typing
  typingContainer: {
    paddingVertical: 12,
  },
  typingInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
  },
  typingTextInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
    paddingVertical: 8,
  },
  typingSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typingSendBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    opacity: 0.45,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 14,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.3)',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  footerLinkText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.45)',
    fontWeight: '600',
  },
});
