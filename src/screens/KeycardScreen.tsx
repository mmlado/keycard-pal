import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { KeycardScreenProps } from '../navigation/types';
import theme from '../theme';

import NFCBottomSheet from '../components/NFCBottomSheet';

import { useKeycardOperation } from '../hooks/keycard/useKeycardOperation';

import {
  buildBtcSignatureUR,
  hashBitcoinMessage,
  parseKeycardBtcMessageSignature,
} from '../utils/btcMessage';
import { BtcSigningSession, buildCryptoPsbtUR } from '../utils/btcPsbt';
import { buildEthSignatureUR } from '../utils/ethSignature';
import {
  buildExportUr,
  exportKeyForWallet,
  prepareSignHash,
  type ExportKeyResult,
} from '../utils/keycardExport';

function buildEthResultUR(
  result: Uint8Array,
  hash: Uint8Array,
  params: {
    dataType?: number;
    chainId?: number;
    requestId?: string;
    signData?: string;
  },
): string {
  const firstByte = params.signData
    ? parseInt(params.signData.slice(0, 2), 16)
    : undefined;
  const txType =
    firstByte === 0x01 || firstByte === 0x02 ? firstByte : undefined;
  return buildEthSignatureUR(
    Array.from(result)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
    hash,
    params.dataType,
    params.chainId,
    params.requestId,
    txType,
  );
}

export default function KeycardScreen({
  route,
  navigation,
}: KeycardScreenProps) {
  const params = route.params;
  const insets = useSafeAreaInsets();
  const hashRef = useRef<Uint8Array | null>(null);
  const btcSessionRef = useRef<BtcSigningSession | null>(null);

  const keycard = useKeycardOperation<
    ExportKeyResult | { psbtHex: string } | Uint8Array
  >();
  const { phase, result, execute, cancel } = keycard;

  const handleSign = useCallback(() => {
    if (params.operation !== 'sign') {
      return;
    }

    if (params.signMode === 'eth') {
      const hash = prepareSignHash(params.signData, params.dataType);
      hashRef.current = hash;

      execute(async cmdSet => {
        const signResp = await cmdSet.signWithPath(
          hash,
          params.derivationPath,
          false,
        );
        signResp.checkOK();
        return signResp.data;
      });
      return;
    }

    if (params.signMode === 'btc-message') {
      const hash = hashBitcoinMessage(params.signDataHex);
      hashRef.current = hash;

      execute(async cmdSet => {
        const signResp = await cmdSet.signWithPath(
          hash,
          params.derivationPath,
          false,
        );
        signResp.checkOK();
        return signResp.data;
      });
      return;
    }

    if (!btcSessionRef.current) {
      btcSessionRef.current = new BtcSigningSession(params.psbtHex);
    }

    execute(async (cmdSet, { setStatus }) => {
      const signed = await btcSessionRef.current!.signWithKeycard(
        cmdSet,
        setStatus,
      );
      return { psbtHex: signed.psbtHex };
    });
  }, [execute, params]);

  const handleExportKey = useCallback(() => {
    if (params.operation !== 'export_key') {
      return;
    }

    execute(
      (cmdSet, { setStatus }) =>
        exportKeyForWallet(cmdSet, params.derivationPath, setStatus),
      { requiresPin: true },
    );
  }, [execute, params]);

  useEffect(() => {
    if (params.operation === 'sign') {
      handleSign();
    } else if (params.operation === 'export_key') {
      handleExportKey();
    }
  }, [handleExportKey, handleSign, params.operation]);

  const navigateToSignResult = useCallback(
    (urString: string) => {
      navigation.reset({
        index: 1,
        routes: [
          { name: 'QRScanner' },
          {
            name: 'QRResult',
            params: { urString, title: 'Show signature to the wallet' },
          },
        ],
      });
    },
    [navigation],
  );

  const navigateToExportResult = useCallback(
    (urString: string) => {
      navigation.reset({
        index: 2,
        routes: [
          { name: 'Dashboard' },
          { name: 'ExportKey' },
          {
            name: 'QRResult',
            params: { urString, title: 'Show key to the wallet' },
          },
        ],
      });
    },
    [navigation],
  );

  const handleEthSignDone = useCallback(() => {
    if (!hashRef.current || !(result instanceof Uint8Array)) {
      return;
    }
    const urString = buildEthResultUR(
      result,
      hashRef.current,
      params as {
        dataType?: number;
        chainId?: number;
        requestId?: string;
        signData?: string;
      },
    );
    navigateToSignResult(urString);
  }, [result, params, navigateToSignResult]);

  const handleBtcSignDone = useCallback(() => {
    if (
      !result ||
      !('psbtHex' in result) ||
      typeof result.psbtHex !== 'string' ||
      result.psbtHex.length === 0
    ) {
      return;
    }
    navigateToSignResult(buildCryptoPsbtUR(result.psbtHex));
  }, [result, navigateToSignResult]);

  const handleBtcMessageSignDone = useCallback(() => {
    if (
      params.operation !== 'sign' ||
      params.signMode !== 'btc-message' ||
      !hashRef.current ||
      !(result instanceof Uint8Array)
    ) {
      return;
    }

    const parsed = parseKeycardBtcMessageSignature(hashRef.current, result);
    navigateToSignResult(
      buildBtcSignatureUR({
        requestId: params.requestId,
        signature: parsed.signature,
        publicKey: parsed.publicKey,
      }),
    );
  }, [result, params, navigateToSignResult]);

  const handleExportKeyDone = useCallback(() => {
    if (
      !result ||
      ArrayBuffer.isView(result) ||
      !(
        'exportRespData' in result ||
        'descriptors' in result ||
        'keys' in result
      )
    ) {
      return;
    }
    navigateToExportResult(
      buildExportUr(
        result,
        (params as { derivationPath: string; source?: string }).derivationPath,
        (params as { derivationPath: string; source?: string }).source,
      ),
    );
  }, [result, params, navigateToExportResult]);

  useEffect(() => {
    if (phase !== 'done' || !result) {
      return;
    }

    const timer = setTimeout(() => {
      try {
        if (params.operation === 'sign' && params.signMode === 'eth') {
          handleEthSignDone();
        } else if (params.operation === 'sign' && params.signMode === 'btc') {
          handleBtcSignDone();
        } else if (
          params.operation === 'sign' &&
          params.signMode === 'btc-message'
        ) {
          handleBtcMessageSignDone();
        } else if (params.operation === 'export_key') {
          handleExportKeyDone();
        }
      } catch (e: any) {
        console.error('[KeycardScreen] Failed to build UR:', e.message);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [
    phase,
    result,
    params,
    handleEthSignDone,
    handleBtcSignDone,
    handleBtcMessageSignDone,
    handleExportKeyDone,
  ]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Enter Keycard PIN' });
  }, [navigation]);

  const handleCancel = useCallback(() => {
    cancel();
    navigation.goBack();
  }, [cancel, navigation]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      <NFCBottomSheet nfc={keycard} onCancel={handleCancel} showOnDone />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
