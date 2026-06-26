// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure platform-specific extensions are resolved correctly.
config.resolver.platforms = ['web', 'android', 'ios', 'native'];

// Allow Metro to bundle TFLite model files as static assets.
// Without this, require('../../../assets/models/detect.tflite') will throw
// an "unknown extension" error at build time.
config.resolver.assetExts = [...config.resolver.assetExts, 'tflite'];

module.exports = config;
