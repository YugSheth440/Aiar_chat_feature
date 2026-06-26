export const typography = {
  title: {
    fontFamily: 'System', // Fallback for SF Pro Display
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 32,
    letterSpacing: -0.02,
  },
  heading: {
    fontFamily: 'System',
    fontSize: 22,
    fontWeight: '600' as const,
    lineHeight: 24,
    letterSpacing: -0.02,
  },
  body: {
    fontFamily: 'System', // Fallback for SF Pro Text
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  caption: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 14,
  },
  sensor: {
    fontFamily: 'Menlo', // Monospace
    fontSize: 11,
    fontWeight: '500' as const,
  },
};
