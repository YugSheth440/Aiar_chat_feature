import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useUiStore } from '../../store/uiStore';
import { X } from 'lucide-react-native';
import { operationalTheme, criticalTheme } from '../../theme/colors';

/**
 * Web stub for GuidancePanel — removes native-only reanimated and BlurView.
 */
export function GuidancePanel() {
  const { activeHazardId, setActiveHazardId, theme: themeMode } = useUiStore();
  const isOpen = activeHazardId !== null;
  const theme = themeMode === 'critical' ? criticalTheme : operationalTheme;

  if (!isOpen) return null;

  return (
    <View style={[styles.container]}>
      <View style={[styles.panel, { backgroundColor: theme.sheetBg, borderColor: 'rgba(255,255,255,0.08)' }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>AI Analysis</Text>
          <Pressable onPress={() => setActiveHazardId(null)} style={styles.closeBtn}>
            <X color={theme.textPrimary} size={20} />
          </Pressable>
        </View>
        <View style={styles.content}>
          <Text style={{ color: theme.textSecondary }}>Landscape Panel Content</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 24,
    top: '10%' as any,
    bottom: '10%' as any,
    width: 400,
    zIndex: 40,
  },
  panel: {
    flex: 1,
    borderRadius: 32,
    borderWidth: 1,
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
    fontSize: 16,
    fontWeight: '600',
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
});
