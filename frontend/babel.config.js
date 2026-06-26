module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required for react-native-worklets-core + VisionCamera useFrameProcessor
      'react-native-worklets-core/plugin',
      // Reanimated must come LAST
      'react-native-reanimated/plugin',
    ],
  };
};
