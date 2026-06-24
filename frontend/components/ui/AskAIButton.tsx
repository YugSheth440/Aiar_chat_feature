import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { MessageCircle, Send, X, Mic } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useChatStore } from '../../store/chatStore';
import { useWorkflowStore } from '../../store/workflowStore';
import { useARTrackingStore } from '../../store/arTrackingStore';
import { ChatBubble } from './ChatBubble';
import { BACKEND_URL } from '../../src/config';

interface AskAIButtonProps {
  audioRecorder: any;
  recorderState: any;
  isTranscribing: boolean;
  setIsTranscribing: (val: boolean) => void;
}

/**
 * AskAIButton — on-demand chat entry point (Phase 5).
 *
 * Behavior:
 *  - Collapsed: small floating pill button "Ask AI" near top-right HUD
 *  - Expanded: glassmorphism input bar slides up
 *  - After response: ChatBubble appears with AI's reply
 *  - Auto-collapses after response is received
 *
 * Does NOT appear during ANALYZING state (main workflow takes priority).
 */
export function AskAIButton({
  audioRecorder,
  recorderState,
  isTranscribing,
  setIsTranscribing,
}: AskAIButtonProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const workflowState = useWorkflowStore((s) => s.workflowState);

  const { isOpen, open, close, isTyping, addUserMessage } = useChatStore();
  const cameraRef = useWorkflowStore((s) => s.cameraRef);

  const [inputText, setInputText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleMicPress = async () => {
    if (isTranscribing) return;

    if (!recorderState.isRecording) {
      try {
        const permission = await getRecordingPermissionsAsync();
        if (!permission.granted) {
          const request = await requestRecordingPermissionsAsync();
          if (!request.granted) {
            alert('Microphone permission is required to record audio.');
            return;
          }
        }

        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (!recorderState.canRecord) {
          await audioRecorder.prepareToRecordAsync();
        }
        await audioRecorder.record();
      } catch (err) {
        console.error('Failed to start recording:', err);
      }
    } else {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await audioRecorder.stop();
        
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
        if (data.text) {
          setInputText((prev) => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${data.text}` : data.text;
          });
        } else if (data.error) {
          console.error('Transcription error from backend:', data.error);
        }
      } catch (err) {
        console.error('Failed to stop or transcribe recording:', err);
      } finally {
        setIsTranscribing(false);
      }
    }
  };

  // Don't show during analysis — focus on the main safety workflow
  if (workflowState === 'SCANNING' || workflowState === 'READY') return null;

  const handleOpen = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    open();
    setTimeout(() => (inputRef.current as any)?.focus(), 200);
  };

  const handleClose = () => {
    Speech.stop();
    close();
    setInputText('');
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isTyping) return;

    Speech.stop();
    setInputText('');
    close();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Add user message to history
    addUserMessage(text);
    useChatStore.getState().setTyping(true);

    // Capture current frame
    try {
      if (!cameraRef) return;
      const photo = await cameraRef.takePhoto({ flash: 'off' });
      const response = await fetch(`file://${photo.path}`);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const b64 = (reader.result as string).split(',')[1];
        
        try {
          const HTTP_URL = `${BACKEND_URL}/chat`;
          
          const res = await fetch(HTTP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              full_frame_b64: b64,
              user_message: text,
              session_id: 'default',
              conversation_history: useChatStore.getState().getHistory(3),
              device_context: { lighting: 'normal', motion: 'low', device_mode: 'chat' }
            })
          });

          if (!res.ok) throw new Error('HTTP request failed');
          
          const data = await res.json();
          
          // Inject the response directly into the UI state
          if (data.spatial_targets?.length > 0) {
            useARTrackingStore.getState().initFromVLM(data.spatial_targets);
          }
          if (data.chat_focus_target_id) {
            useARTrackingStore.getState().setChatFocusTarget(data.chat_focus_target_id);
          }
          const chatReply = data.chat_reply || data.summary || '';
          useChatStore.getState().addAssistantMessage(chatReply, data.chat_focus_target_id ?? null);
          useChatStore.getState().setTyping(false);

          // Voice-assisted transitions based on user voice text
          const lowercaseText = text.toLowerCase();
          const workflowStore = useWorkflowStore.getState();

          // 1. Mode selection
          if (lowercaseText.includes('troubleshoot') || lowercaseText.includes('diagnose')) {
            workflowStore.selectMode('troubleshoot');
          } else if (lowercaseText.includes('explain') || lowercaseText.includes('explore')) {
            workflowStore.selectMode('explain');
          } else if (lowercaseText.includes('guide') || lowercaseText.includes('procedure') || lowercaseText.includes('step-by-step') || lowercaseText.includes('step by step')) {
            workflowStore.selectMode('guide');
          }

          // 2. Navigation
          if (lowercaseText.includes('next') || lowercaseText.includes('forward')) {
            if (workflowStore.activeMode === 'guide') {
              workflowStore.nextStep();
            } else {
              workflowStore.nextComponent();
            }
          } else if (
            lowercaseText.includes('prev') ||
            lowercaseText.includes('back') ||
            lowercaseText.includes('previous')
          ) {
            if (workflowStore.activeMode === 'guide') {
              workflowStore.prevStep();
            } else {
              workflowStore.prevComponent();
            }
          }

          // 3. Highlighting component target by name or VLM response ID
          const components = workflowStore.components;
          let matchedComponentIdx = -1;
          for (let i = 0; i < components.length; i++) {
            const comp = components[i];
            if (
              lowercaseText.includes(comp.id.toLowerCase()) ||
              lowercaseText.includes(comp.label.toLowerCase())
            ) {
              matchedComponentIdx = i;
              break;
            }
          }
          if (matchedComponentIdx !== -1) {
            workflowStore.setActiveComponentIndex(matchedComponentIdx);
          } else if (data.chat_focus_target_id) {
            const targetIdx = components.findIndex((c) => c.id === data.chat_focus_target_id);
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
    >
      {/* Chat bubble response display */}
      <ChatBubble />

      {/* Collapsed pill button */}
      {!isOpen && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[styles.pillWrapper, { top: Math.max(insets.top, 30) + 16, right: 16 }]}
          pointerEvents="box-none"
        >
          <Pressable onPress={handleOpen} style={({ pressed }) => [styles.pill, pressed && { opacity: 0.8 }]}>
            <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
            <MessageCircle color="#60a5fa" size={15} strokeWidth={2.5} />
            <Text style={styles.pillText}>Ask AI</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Expanded input bar */}
      {isOpen && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[styles.inputWrapper, { bottom: Math.max(insets.bottom, 20) + 16 }]}
          pointerEvents="auto"
        >
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.inputOverlay]} />

          <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={10}>
            <X color="rgba(255,255,255,0.45)" size={18} strokeWidth={2} />
          </Pressable>

          <TextInput
            ref={inputRef}
            style={styles.textInput}
            placeholder={
              isTranscribing
                ? "Transcribing audio..."
                : recorderState.isRecording
                ? "Listening..."
                : "What is this? Is it safe?"
            }
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline={false}
            maxLength={200}
            editable={!isTranscribing && !recorderState.isRecording}
          />

          {isTranscribing ? (
            <ActivityIndicator size="small" color="#60a5fa" style={styles.micBtn} />
          ) : (
            <Pressable
              onPress={handleMicPress}
              style={({ pressed }) => [
                styles.micBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Mic
                color={recorderState.isRecording ? "#ef4444" : "#60a5fa"}
                size={18}
                strokeWidth={2.5}
              />
            </Pressable>
          )}

          <Pressable
            onPress={handleSend}
            disabled={!inputText.trim() || isTyping || recorderState.isRecording || isTranscribing}
            style={({ pressed }) => [
              styles.sendBtn,
              (!inputText.trim() || isTyping || recorderState.isRecording || isTranscribing) && { opacity: 0.35 },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Send color="#60a5fa" size={18} strokeWidth={2.5} />
          </Pressable>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pillWrapper: {
    position: 'absolute',
    zIndex: 200,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 99,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.25)',
    backgroundColor: 'rgba(10,12,20,0.7)',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#60a5fa',
    letterSpacing: 0.2,
  },
  inputWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.2)',
    zIndex: 200,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  inputOverlay: {
    backgroundColor: 'rgba(8,10,20,0.5)',
  },
  closeBtn: {
    zIndex: 1,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    zIndex: 1,
    paddingVertical: 0,
  },
  sendBtn: {
    zIndex: 1,
  },
  micBtn: {
    zIndex: 1,
    paddingHorizontal: 4,
  },
});
