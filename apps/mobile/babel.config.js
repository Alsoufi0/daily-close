module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // react-native-reanimated/plugin must be listed LAST. Required by
    // react-native-reanimated (which @react-navigation/drawer depends on).
    plugins: ["react-native-reanimated/plugin"]
  };
};
