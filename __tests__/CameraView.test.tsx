import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import CameraView from '../src/components/CameraView';

jest.mock('../src/components/Camera', () => ({
  Camera: ({ onReadCode }: any) => {
    const { View } = require('react-native');
    return <View testID="camera" onReadCode={onReadCode} />;
  },
}));

// The CAMERA permission lives in this component, not in the screens: the
// SeedQR overlay mounts it directly, and when the request lived only in
// QRScannerScreen that overlay opened a blank viewfinder on any device that
// had not already granted access through the transaction scanner (#276).
describe('CameraView — android camera permission', () => {
  const { PermissionsAndroid, Platform } = require('react-native');
  let originalOS: string;
  let originalRequest: typeof PermissionsAndroid.request;

  beforeEach(() => {
    originalOS = Platform.OS;
    originalRequest = PermissionsAndroid.request;
    (Platform as any).OS = 'android';
  });

  afterEach(() => {
    (Platform as any).OS = originalOS;
    PermissionsAndroid.request = originalRequest;
  });

  it('requests the permission when mounted', async () => {
    PermissionsAndroid.request = jest
      .fn()
      .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

    render(<CameraView onReadCode={jest.fn()} />);
    await act(async () => {});

    expect(PermissionsAndroid.request).toHaveBeenCalledWith(
      PermissionsAndroid.PERMISSIONS.CAMERA,
    );
    expect(screen.getByTestId('camera')).toBeTruthy();
  });

  it('shows the recovery UI instead of the camera when denied', async () => {
    PermissionsAndroid.request = jest
      .fn()
      .mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);

    render(<CameraView onReadCode={jest.fn()} />);
    await act(async () => {});

    expect(screen.getByText('Camera Permission Required')).toBeTruthy();
    expect(screen.getByText('Open Settings')).toBeTruthy();
    expect(screen.queryByTestId('camera')).toBeNull();
  });

  it('sends the user to system settings from the denied state', async () => {
    const { Linking } = require('react-native');
    const openSettings = jest
      .spyOn(Linking, 'openSettings')
      .mockResolvedValue(undefined as never);
    PermissionsAndroid.request = jest
      .fn()
      .mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);

    render(<CameraView onReadCode={jest.fn()} />);
    await act(async () => {});
    fireEvent.press(screen.getByText('Open Settings'));

    expect(openSettings).toHaveBeenCalledTimes(1);
    openSettings.mockRestore();
  });

  it('treats a failed request as denied rather than showing a dead viewfinder', async () => {
    PermissionsAndroid.request = jest
      .fn()
      .mockRejectedValue(new Error('request failed'));

    render(<CameraView onReadCode={jest.fn()} />);
    await act(async () => {});

    expect(screen.getByText('Camera Permission Required')).toBeTruthy();
    expect(screen.queryByTestId('camera')).toBeNull();
  });
});

describe('CameraView', () => {
  it('renders the camera', () => {
    render(<CameraView onReadCode={jest.fn()} />);
    expect(screen.getByTestId('camera')).toBeTruthy();
  });

  it('does not request the permission on iOS, which prompts on first use', () => {
    const { PermissionsAndroid, Platform } = require('react-native');
    const originalOS = Platform.OS;
    const originalRequest = PermissionsAndroid.request;
    (Platform as any).OS = 'ios';
    PermissionsAndroid.request = jest.fn();

    render(<CameraView onReadCode={jest.fn()} />);

    expect(PermissionsAndroid.request).not.toHaveBeenCalled();
    expect(screen.getByTestId('camera')).toBeTruthy();

    (Platform as any).OS = originalOS;
    PermissionsAndroid.request = originalRequest;
  });

  it('passes onReadCode to Camera', () => {
    const handler = jest.fn();
    render(<CameraView onReadCode={handler} />);
    expect(screen.getByTestId('camera').props.onReadCode).toBe(handler);
  });

  it('renders children', () => {
    render(
      <CameraView onReadCode={jest.fn()}>
        <Text>overlay</Text>
      </CameraView>,
    );
    expect(screen.getByText('overlay')).toBeTruthy();
  });
});
