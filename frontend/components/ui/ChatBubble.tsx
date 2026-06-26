import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  FadeInUp,
  FadeOutDown,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { MessageCircle, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import { useChatStore } from '../../store/chatStore';

const AUTO_DISMISS_MS = 8000;

// ─── VOICE CONFIG ────────────────────────────────────────────────────────────
// Set a specific voice identifier here to override auto-selection.
// Leave as null to auto-pick the best English voice for your platform.
// Run the app and check Expo logs to see all available voice IDs on your device.
//
// Android examples:
//   'en-us-x-tpc-local'          ← Google US English (local)
//   'en-us-x-sfg#male_1-local'   ← Google US English Male
//   'en-gb-x-gbb#male_2-local'   ← Google UK English Male
//   'en-us-x-iom-network'        ← Google US English (network / higher quality)
//
const PREFERRED_VOICE_ID: string | null = null;
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ChatBubble — displays the AI's chat_reply above the bottom sheet.
 *
 * Behavior:
 *  - Spring-in from bottom when new assistant message arrives
 *  - Auto-dismisses after 8s or when user taps X
 *  - Spotlights the chat_focus_target_id AR marker (handled by useWebSocket → arTrackingStore)
 */
export function ChatBubble() {
  const insets = useSafeAreaInsets();
  const { messages, isTyping } = useChatStore();
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedVoice, setSelectedVoice] = React.useState<string | undefined>(undefined);

  // Last assistant message
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  const visible = useSharedValue(0);


  // Load the best available voice once on mount
  useEffect(() => {
    async function loadVoices() {
      try {
        const voices = await Speech.getAvailableVoicesAsync();

        // Log all voices so you can pick one by identifier
        console.log('[Speech] Available voices on this device:');
        voices.forEach((v: Speech.Voice) => {
          console.log(`  [${v.language}] ${v.identifier}  quality=${v.quality === Speech.VoiceQuality.Enhanced ? 'Enhanced' : 'Default'} name=${v.name}`);
        });

        // Use hardcoded voice if set, otherwise auto-pick best English
        if (PREFERRED_VOICE_ID) {
          const found = voices.find((v: Speech.Voice) => v.identifier === PREFERRED_VOICE_ID);
          if (found) {
            console.log('[Speech] Using preferred voice:', found.identifier);
            setSelectedVoice(found.identifier);
            return;
          }
          console.warn('[Speech] Preferred voice not found, falling back to auto-select.');
        }

        // Auto-select based on platform
        let picked: Speech.Voice | undefined;

        if (Platform.OS === 'android') {
          // Android: prefer Google TTS network (highest quality) → local → any English
          picked =
            voices.find((v: Speech.Voice) => v.language.startsWith('en') && v.identifier.includes('network')) ||
            voices.find((v: Speech.Voice) => v.language.startsWith('en-us') && v.identifier.includes('local')) ||
            voices.find((v: Speech.Voice) => v.language.startsWith('en'));
        } else {
          // iOS: prefer Enhanced (Siri) quality first
          picked =
            voices.find((v: Speech.Voice) => v.language.startsWith('en') && v.quality === Speech.VoiceQuality.Enhanced) ||
            voices.find((v: Speech.Voice) => v.language.startsWith('en'));
        }

        if (picked) {
          console.log(`[Speech] Auto-selected voice (${Platform.OS}):`, picked.identifier);
          setSelectedVoice(picked.identifier);
        }
      } catch (err) {
        console.error('Failed to load speech voices:', err);
      }
    }
    loadVoices();
  }, []);

  useEffect(() => {
    if (lastAssistant) {
      visible.value = withSpring(1, { damping: 18, stiffness: 280 });

      // Speak the AI response using the best selected voice
      Speech.stop();
      Speech.speak(lastAssistant.content, {
        voice: selectedVoice,
        rate: 0.95, // slightly slower for a more natural cadence
      });

      // Auto-dismiss
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(() => {
        visible.value = withTiming(0, { duration: 400 });
      }, AUTO_DISMISS_MS);
    }
    return () => {
      Speech.stop();
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [lastAssistant?.id, selectedVoice]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [{ translateY: (1 - visible.value) * 20 }],
  }));

  const handleDismiss = () => {
    Speech.stop();
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    visible.value = withTiming(0, { duration: 300 });
  };

  // Typing indicator
  if (isTyping && !lastAssistant) {
    return (
      <Animated.View
        entering={FadeInUp.springify().damping(20)}
        exiting={FadeOutDown.duration(200)}
        style={[styles.bubble, styles.typingBubble, { bottom: insets.bottom + 120 }]}
        pointerEvents="none"
      >
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.overlay]} />
        <View style={styles.typingDots}>
          <TypingDot delay={0} />
          <TypingDot delay={180} />
          <TypingDot delay={360} />
        </View>
      </Animated.View>
    );
  }

  if (!lastAssistant) return null;

  return (
    <Animated.View
      style={[styles.bubble, { bottom: insets.bottom + 120 }, containerStyle]}
      pointerEvents="box-none"
    >
      <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.aiBadge}>
            <MessageCircle color="#60a5fa" size={12} strokeWidth={2.5} />
          </View>
          <Text style={styles.headerLabel}>AI Response</Text>
        </View>
        <Pressable onPress={handleDismiss} hitSlop={12}>
          <X color="rgba(255,255,255,0.4)" size={16} strokeWidth={2} />
        </Pressable>
      </View>

      {/* Reply text */}
      <Text style={styles.replyText}>{lastAssistant.content}</Text>

      {lastAssistant.focusTargetId && (
        <View style={styles.focusHint}>
          <View style={styles.focusDot} />
          <Text style={styles.focusHintText}>AR highlight active</Text>
        </View>
      )}
    </Animated.View>
  );
}

function TypingDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withSpring(1, { damping: 6 })
    );
  }, [delay]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.18)',
    padding: 14,
    zIndex: 10000,
    elevation: 10000,
  },
  typingBubble: {
    paddingVertical: 16,
  },
  overlay: {
    backgroundColor: 'rgba(8,10,20,0.55)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  aiBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(96,165,250,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#60a5fa',
    letterSpacing: 0.3,
  },
  replyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
  focusHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  focusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#60a5fa',
  },
  focusHintText: {
    fontSize: 11,
    color: 'rgba(96,165,250,0.7)',
    fontWeight: '500',
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#60a5fa',
  },
});
