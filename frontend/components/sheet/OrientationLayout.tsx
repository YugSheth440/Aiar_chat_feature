import React, { useEffect } from 'react';
import { useWindowDimensions, View, StyleSheet } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { GuidancePanel } from './GuidancePanel';
import { useUiStore } from '../../store/uiStore';

export function OrientationLayout() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { setIsLandscape } = useUiStore();

  useEffect(() => {
    setIsLandscape(isLandscape);
  }, [isLandscape, setIsLandscape]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {isLandscape ? <GuidancePanel /> : <BottomSheet />}
    </View>
  );
}
