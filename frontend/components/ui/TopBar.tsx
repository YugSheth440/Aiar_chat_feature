import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Settings } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// TopBar is kept minimal — StatusCapsule and LeftControls are self-contained.
export function TopBar({ onSettingsClick }: { onSettingsClick?: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      entering={FadeInDown.delay(100).springify()}
      style={[styles.container, { top: insets.top + 16 }]}
      pointerEvents="box-none"
    >
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        onPress={onSettingsClick}
      >
        <BlurView intensity={50} tint="dark" style={styles.blurBtn}>
          <Settings color="#FFFFFF" size={20} />
        </BlurView>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    zIndex: 90,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  blurBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  btnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
});
