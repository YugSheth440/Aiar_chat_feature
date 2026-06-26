import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

// Define RiskLevel here to avoid importing from types.ts temporarily
type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const LEVEL_CONFIG: Record<RiskLevel, { label: string; bg: string; text: string; dot: string }> = {
  LOW:      { label: 'Low Risk',    bg: 'rgba(22,163,74,0.15)',  text: '#4ade80', dot: '#4ade80' },
  MEDIUM:   { label: 'Med Risk',    bg: 'rgba(245,130,13,0.15)', text: '#fb923c', dot: '#fb923c' },
  HIGH:     { label: 'High Risk',   bg: 'rgba(229,53,53,0.18)',  text: '#f87171', dot: '#f87171' },
  CRITICAL: { label: 'High Risk',   bg: 'rgba(229,53,53,0.20)',  text: '#ef4444', dot: '#ef4444' },
};

interface Props {
  level: RiskLevel;
  pulse?: boolean;
  size?: 'sm' | 'md';
}

export function RiskBadge({ level, pulse = false, size = 'sm' }: Props) {
  const cfg = LEVEL_CONFIG[level];
  const isHigh = level === 'HIGH' || level === 'CRITICAL';

  const animatedDotStyle = useAnimatedStyle(() => {
    if (pulse && isHigh) {
      return {
        opacity: withRepeat(withSequence(withTiming(0.4, { duration: 1000 }), withTiming(1, { duration: 1000 })), -1, true),
      };
    }
    return { opacity: 1 };
  });

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: `${cfg.dot}33` }, size === 'sm' ? styles.sm : styles.md]}>
      <Animated.View style={[styles.dot, { backgroundColor: cfg.dot }, animatedDotStyle]} />
      <Text style={[styles.text, { color: cfg.text }, size === 'sm' ? styles.textSm : styles.textMd]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 99,
    borderWidth: 1,
  },
  sm: { paddingHorizontal: 10, paddingVertical: 4 },
  md: { paddingHorizontal: 12, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  text: { fontWeight: '600' },
  textSm: { fontSize: 12 },
  textMd: { fontSize: 14 }
});
