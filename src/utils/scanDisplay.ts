import { NativeModules } from 'react-native';

const nativeScanDisplay = NativeModules.ScanDisplay as
  | { raise(): void; restore(): void }
  | undefined;

export function raiseScanDisplay(): void {
  nativeScanDisplay?.raise();
}

export function restoreScanDisplay(): void {
  nativeScanDisplay?.restore();
}
