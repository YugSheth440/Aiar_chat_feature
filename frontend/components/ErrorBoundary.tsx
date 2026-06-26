/**
 * ErrorBoundary.tsx — Global React error boundary.
 *
 * Catches any component-level render errors and shows a safe recovery UI
 * instead of a white screen crash. This is production-grade protection for:
 *  - Reanimated worklet failures
 *  - Skia rendering errors
 *  - Store state corruption
 *  - Unexpected null dereferences
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<Record<string, unknown>>,
  State
> {
  constructor(props: React.PropsWithChildren<Record<string, unknown>>) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[FixSight] Unhandled render error:', error.message);
    console.error('[FixSight] Component stack:', info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.icon}>⚠️</Text>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </Text>
            <Pressable style={styles.btn} onPress={this.handleReset}>
              <Text style={styles.btnText}>Try Again</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080a12',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    width: '100%',
    maxWidth: 380,
  },
  icon: {
    fontSize: 40,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  btn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
