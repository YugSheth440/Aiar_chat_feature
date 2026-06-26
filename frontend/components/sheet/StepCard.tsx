import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Check, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export interface ActionStep {
  id: string;
  stepNumber: number;
  title: string;
  subtitle: string;
}

interface Props {
  step: ActionStep;
  index?: number;
  isCompleted: boolean;
  onToggle: (id: string) => void;
  isCriticalMode?: boolean;
  compact?: boolean;
}

export function StepCard({ step, index = 1, isCompleted, onToggle, compact = false }: Props) {
  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(step.id);
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      borderColor: withTiming(isCompleted ? 'rgba(29, 106, 229, 0.3)' : 'rgba(255,255,255,0.05)', { duration: 250 }),
      backgroundColor: withTiming(compact ? 'transparent' : (index === 1 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)'), { duration: 250 }),
    };
  });

  return (
    <Pressable onPress={handleToggle}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <View style={styles.leftGroup}>
          <View style={[styles.numberCircle, { backgroundColor: index === 1 ? (compact ? 'rgba(255,255,255,0.08)' : '#4ade80') : 'rgba(255,255,255,0.05)' }]}>
            <Text style={[styles.numberText, { color: index === 1 ? (compact ? '#FFFFFF' : '#111D36') : 'rgba(255,255,255,0.6)' }]}>{index}</Text>
          </View>
          <View style={styles.textGroup}>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.subtitle}>{step.subtitle}</Text>
          </View>
        </View>

        <View style={styles.rightGroup}>
          {compact ? (
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(29, 106, 229, 0.3)' }]}>
              <ChevronRight color="#8BB4F6" size={16} />
            </View>
          ) : isCompleted ? (
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(29, 106, 229, 0.1)', borderColor: '#1D6AE5', borderWidth: 2 }]}>
              <Check color="#1D6AE5" size={14} />
            </View>
          ) : (
            <View style={[styles.iconCircle, { borderColor: 'rgba(255,255,255,0.1)', borderWidth: 2 }]} />
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  numberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  numberText: {
    fontWeight: '700',
    fontSize: 13,
  },
  textGroup: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 2,
  },
  rightGroup: {
    marginLeft: 12,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
