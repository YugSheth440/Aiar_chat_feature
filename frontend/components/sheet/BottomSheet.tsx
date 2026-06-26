import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import BottomSheetGorhom, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useUiStore } from '../../store/uiStore';
import { useSceneStore } from '../../store/sceneStore';
import { operationalTheme, criticalTheme } from '../../theme/colors';
import { StepCard } from './StepCard';
import { AlertTriangle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export function BottomSheet() {
  const { sheetPosition, setSheetPosition, theme: themeMode } = useUiStore();
  const { 
    spatial_targets, 
    primary_hazard, 
    summary, 
    fallbackMode, 
    fallback_plan,
    triggerFallbackMode 
  } = useSceneStore();
  
  const bottomSheetRef = useRef<BottomSheetGorhom>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const snapPoints = useMemo(() => ['15%', '50%', '90%'], []);
  const theme = fallbackMode || themeMode === 'critical' ? criticalTheme : operationalTheme;

  const handleSheetChanges = useCallback((index: number) => {
    if (index === 0) setSheetPosition('collapsed');
    else if (index === 1) setSheetPosition('half');
    else if (index === 2) setSheetPosition('full');
  }, [setSheetPosition]);

  useEffect(() => {
    if (sheetPosition === 'collapsed') bottomSheetRef.current?.snapToIndex(0);
    else if (sheetPosition === 'half') bottomSheetRef.current?.snapToIndex(1);
    else if (sheetPosition === 'full') bottomSheetRef.current?.snapToIndex(2);
  }, [sheetPosition]);

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
    <BottomSheetGorhom
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      backgroundStyle={{ backgroundColor: theme.sheetBg }}
      handleIndicatorStyle={{ backgroundColor: 'rgba(255,255,255,0.3)' }}
    >
      <BottomSheetView style={styles.contentContainer}>
        {fallbackMode ? (
          <View style={styles.fallbackContainer}>
            <AlertTriangle color="#ef4444" size={32} />
            <Text style={[styles.fallbackTitle, { color: theme.textPrimary }]}>⚠ EMERGENCY FALLBACK</Text>
            <Text style={[styles.fallbackText, { color: theme.textSecondary }]}>{fallback_plan}</Text>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                {primary_hazard || 'Guidance Procedures'}
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {summary || 'Follow these steps sequentially to resolve the issue safely.'}
              </Text>
            </View>

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
          </>
        )}
      </BottomSheetView>
    </BottomSheetGorhom>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
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
    padding: 24,
    marginTop: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  fallbackTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  fallbackText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  }
});
