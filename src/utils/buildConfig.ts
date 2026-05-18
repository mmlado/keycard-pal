/* istanbul ignore file */
import { NativeModules, Platform } from 'react-native';

const nativeBuildConfig = NativeModules.BuildConfig as
  | { INTERNET_ENABLED: boolean; WC_PROJECT_ID: string }
  | undefined;

// iOS has no offline flavor — internet is always available there
export const INTERNET_ENABLED: boolean =
  Platform.OS === 'android'
    ? nativeBuildConfig?.INTERNET_ENABLED ?? true
    : true;

export const WC_PROJECT_ID: string = nativeBuildConfig?.WC_PROJECT_ID ?? '';
