import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  useColorScheme,
  View,
  Button,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RNKeycard from 'react-native-keycard';
import Keycard from 'keycard-sdk';

import { APP_NAME } from '@/constants/app';

function toHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

type LogEntry = {
  timestamp: string;
  message: string;
};

export default function KeycardLogScreen() {
  const insets = useSafeAreaInsets();
  const isDarkMode = useColorScheme() === 'dark';
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [scanning, setScanning] = useState(false);
  const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[Keycard] ${message}`);
    setLogs(prev => [{ timestamp, message }, ...prev]);
  }, []);

  const selectKeycardApplet = useCallback(async () => {
    try {
      addLog('Selecting Keycard applet...');
      const channel = new RNKeycard.NFCCardChannel();
      const cmdSet = new Keycard.Commandset(channel);
      const resp = await cmdSet.select();

      addLog(`SELECT response SW: 0x${resp.sw.toString(16).toUpperCase()}`);

      if (resp.sw !== 0x9000) {
        addLog(
          `SELECT failed with status: 0x${resp.sw.toString(16).toUpperCase()}`,
        );
        return;
      }

      const appInfo = cmdSet.applicationInfo;
      if (!appInfo) {
        addLog('No application info returned');
        return;
      }

      addLog(`--- Card Info ---`);
      addLog(`Initialized: ${appInfo.initializedCard}`);
      addLog(
        `Instance UID: ${
          appInfo.instanceUID ? toHex(appInfo.instanceUID) : 'N/A'
        }`,
      );
      addLog(`App Version: ${appInfo.getAppVersionString()}`);
      addLog(`Free Pairing Slots: ${appInfo.freePairingSlots}`);
      addLog(`Has Master Key: ${appInfo.hasMasterKey()}`);
      addLog(`Key UID: ${appInfo.keyUID ? toHex(appInfo.keyUID) : 'N/A'}`);
      addLog(
        `Secure Channel PubKey: ${
          appInfo.secureChannelPubKey
            ? toHex(appInfo.secureChannelPubKey)
            : 'N/A'
        }`,
      );
      addLog(
        `Capabilities: 0x${appInfo.capabilities.toString(16).padStart(2, '0')}`,
      );
      addLog(`  Secure Channel: ${appInfo.hasSecureChannelCapability()}`);
      addLog(`  Key Management: ${appInfo.hasKeyManagementCapability()}`);
      addLog(
        `  Credentials Mgmt: ${appInfo.hasCredentialsManagementCapability()}`,
      );
      addLog(`  NDEF: ${appInfo.hasNDEFCapability()}`);
      addLog(`--- End Card Info ---`);
    } catch (error: any) {
      addLog(`SELECT error: ${error.message}`);
    }
  }, [addLog]);

  useEffect(() => {
    RNKeycard.Core.isNFCSupported().then(supported => {
      setNfcSupported(supported);
      if (supported) {
        addLog('NFC is supported on this device');
      } else {
        addLog('NFC is NOT supported on this device');
      }
    });
  }, [addLog]);

  useEffect(() => {
    const connectedSub = RNKeycard.Core.onKeycardConnected(() => {
      addLog('Keycard CONNECTED - card tapped');
      selectKeycardApplet();
    });

    const disconnectedSub = RNKeycard.Core.onKeycardDisconnected(() => {
      addLog('Keycard DISCONNECTED - card removed');
    });

    const nfcEnabledSub = RNKeycard.Core.onKeycardNFCEnabled(() => {
      addLog('NFC has been enabled');
    });

    const nfcDisabledSub = RNKeycard.Core.onKeycardNFCDisabled(() => {
      addLog('NFC has been disabled');
    });

    const cancelledSub = RNKeycard.Core.onNFCUserCancelled(() => {
      addLog('NFC scan cancelled by user');
      setScanning(false);
    });

    const timeoutSub = RNKeycard.Core.onNFCTimeout(() => {
      addLog('NFC scan timed out');
      setScanning(false);
    });

    return () => {
      connectedSub.remove();
      disconnectedSub.remove();
      nfcEnabledSub.remove();
      nfcDisabledSub.remove();
      cancelledSub.remove();
      timeoutSub.remove();
    };
  }, [addLog, selectKeycardApplet]);

  const startScanning = async () => {
    try {
      const enabled = await RNKeycard.Core.isNFCEnabled();
      if (!enabled) {
        addLog('NFC is disabled. Opening settings...');
        await RNKeycard.Core.openNFCSettings();
        return;
      }

      addLog('Starting NFC scan - tap your Keycard...');
      await RNKeycard.Core.startNFC('Tap your Keycard');
      setScanning(true);
    } catch (error: any) {
      addLog(`Error starting NFC: ${error.message}`);
    }
  };

  const stopScanning = async () => {
    try {
      await RNKeycard.Core.stopNFC();
      setScanning(false);
      addLog('NFC scan stopped');
    } catch (error: any) {
      addLog(`Error stopping NFC: ${error.message}`);
    }
  };

  const bgColor = isDarkMode ? '#1a1a1a' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#000000';
  const logBgColor = isDarkMode ? '#2a2a2a' : '#f0f0f0';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <Text style={[styles.title, { color: textColor }]}>{APP_NAME}</Text>
      <Text style={[styles.subtitle, { color: textColor }]}>
        Keycard NFC Scanner
      </Text>

      {nfcSupported === false && (
        <Text style={styles.warning}>NFC is not supported on this device</Text>
      )}

      <View style={styles.buttonRow}>
        <Button
          title={scanning ? 'Scanning...' : 'Start Scan'}
          onPress={startScanning}
          disabled={scanning || nfcSupported === false}
        />
        <View style={styles.buttonSpacer} />
        <Button title="Stop Scan" onPress={stopScanning} disabled={!scanning} />
      </View>

      <Text style={[styles.logHeader, { color: textColor }]}>Event Log</Text>
      <ScrollView
        style={[styles.logContainer, { backgroundColor: logBgColor }]}
      >
        {logs.length === 0 ? (
          <Text style={[styles.logPlaceholder, { color: textColor }]}>
            No events yet. Start scanning and tap a Keycard.
          </Text>
        ) : (
          logs.map((entry, index) => (
            <Text key={index} style={[styles.logEntry, { color: textColor }]}>
              [{entry.timestamp}] {entry.message}
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  warning: {
    color: '#ff4444',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  buttonSpacer: {
    width: 16,
  },
  logHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  logContainer: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
  },
  logPlaceholder: {
    fontStyle: 'italic',
    opacity: 0.5,
  },
  logEntry: {
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 4,
  },
});
