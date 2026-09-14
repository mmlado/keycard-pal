import { MD3DarkTheme } from 'react-native-paper';

const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#FF6400',
    secondary: '#1C8A80',
    surface: '#1e1e1e',
    surfaceVariant: '#2d2d2d',
    surfaceElevated: '#2A2A2A',
    surfaceList: '#FFFFFF0D',
    surfaceSelected: '#474747',
    surfaceChoice: '#4A4459',
    surfacePassphrase: '#2A2438',
    background: '#121212',
    cameraBackground: '#000000',
    onSurface: '#ffffff',
    onSurfaceVariant: 'rgba(255,255,255,0.7)',
    onSurfaceMuted: 'rgba(255,255,255,0.6)',
    onSurfaceSubtle: 'rgba(255,255,255,0.5)',
    onSurfaceDisabled: 'rgba(255,255,255,0.4)',
    onSurfacePlaceholder: 'rgba(255,255,255,0.3)',
    outline: '#919191',
    outlineActive: '#C6C6C6',
    overlay: 'rgba(0,0,0,0.55)',
    secondaryRipple: 'rgba(28,138,128,0.15)',
    ripple: 'rgba(255,255,255,0.2)',
    progressTrack: '#FFFFFF1A',
    error: '#E95460',
    errorDark: '#BA434D',
    negative: '#cf6679',
    success: '#1C8A80',
  },
};

export default theme;
