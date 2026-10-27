module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
        },
      },
    ],
    // Last, as Reanimated's Worklets requires.
    'react-native-worklets/plugin',
  ],
};
