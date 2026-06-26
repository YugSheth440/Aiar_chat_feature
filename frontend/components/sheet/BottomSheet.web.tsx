import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useUiStore } from '../../store/uiStore';
import { useSceneStore } from '../../store/sceneStore';
import { operationalTheme, criticalTheme } from '../../theme/colors';

/**
 * Web replacement for BottomSheet.
 * @gorhom/bottom-sheet is native-only. This provides a simple
 * scrollable panel at the bottom for web browsers.
 */
export function BottomSheet() {
  const { theme: themeMode } = useUiStore();
  const theme = themeMode === 'critical' ? criticalTheme : operationalTheme;

  return (
    <View style={[styles.container, { backgroundColor: theme.sheetBg }]}>
      <View style={styles.handle} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={[styles.text, { color: theme.textPrimary }]}>
          Guidance Content Area
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
  },
});
