import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInRight, FadeOutRight } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useUiStore } from '../../store/uiStore';
import { useSceneStore } from '../../store/sceneStore';
import { X, AlertTriangle } from 'lucide-react-native';
import { operationalTheme, criticalTheme } from '../../theme/colors';
import { StepCard } from './StepCard';
import * as Haptics from 'expo-haptics';

export function GuidancePanel() {
  const { setActiveHazardId, theme: themeMode } = useUiStore();
  const { 
    spatial_targets, 
    primary_hazard, 
    summary, 
    fallbackMode, 
    fallback_plan,
    triggerFallbackMode 
  } = useSceneStore();
  
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  // Show panel even if activeHazardId is null so user can see it during testing, 
  const isOpen = true; 
  const theme = fallbackMode || themeMode === 'critical' ? criticalTheme : operationalTheme;

  if (!isOpen) return null;

  const toggleStep = (id: string) => {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleActionIneffective = useCallback(() => {
    triggerFallbackMode();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, [triggerFallbackMode]);

  const steps = spatial_targets.map((tgt, i) => ({
    id: tgt.id,
    stepNumber: i + 1,
    title: tgt.label,
    subtitle: (tgt as any).guidance ?? '',
    icon: 'info',
    isCritical: tgt.type === 'threat_multiplier',
  }));

  return (
    <Animated.View 
      entering={FadeInRight.springify()} 
      exiting={FadeOutRight.springify()} 
      style={styles.container}
    >
      <BlurView intensity={70} tint="dark" style={[styles.panel, { backgroundColor: theme.sheetBg }]}>
        {fallbackMode ? (
          <View style={[styles.content, styles.fallbackContainer]}>
            <AlertTriangle color="#ef4444" size={36} />
            <Text style={[styles.fallbackTitle, { color: theme.textPrimary }]}>⚠ EMERGENCY FALLBACK</Text>
            <Text style={[styles.fallbackText, { color: theme.textSecondary }]}>{fallback_plan}</Text>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                {primary_hazard || 'Guidance Procedures'}
              </Text>
              <Pressable onPress={() => setActiveHazardId(null)} style={styles.closeBtn}>
                <X color={theme.textPrimary} size={20} />
              </Pressable>
            </View>
            <View style={styles.content}>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {summary || 'Follow these steps sequentially to resolve the issue safely.'}
              </Text>
              <View style={styles.stepsContainer}>
                {steps.map((step, index) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    index={index + 1}
                    isCompleted={completedSteps.has(step.id)}
                    onToggle={toggleStep}
                    isCriticalMode={themeMode === 'critical'}
                  />
                ))}
                
                {steps.length > 0 && (
                  <Pressable
                    id="action-ineffective-btn"
                    style={styles.ineffectiveBtn}
                    onPress={handleActionIneffective}
                  >
                    <AlertTriangle color="#ef4444" size={18} />
                    <Text style={styles.ineffectiveBtnText}>
                      Action Ineffective — Situation Worsening
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </>
        )}
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 24,
    top: '10%',
    bottom: '10%',
    width: 400,
    zIndex: 40,
  },
  panel: {
    flex: 1,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  stepsContainer: {
    gap: 12,
  },
  ineffectiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
  },
  ineffectiveBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  fallbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  fallbackTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  fallbackText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  }
});
