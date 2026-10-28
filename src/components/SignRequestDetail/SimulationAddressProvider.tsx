import React, { createContext, useCallback, useContext } from 'react';
import { useNavigation } from '@react-navigation/native';
import Keycard from 'keycard-sdk';
import { Commandset } from 'keycard-sdk/dist/commandset';

import { useKeycardOp } from '@/hooks/keycard/useKeycardOperation';
import {
  useKeycardScreen,
  type KeycardScreenNavigation,
} from '@/hooks/useKeycardScreen';

import { pubKeyToEthAddress } from '@/utils/ethereumAddress';

export type SimulationAddressOp = ReturnType<typeof useKeycardOp<string>>;

const SimulationAddressContext = createContext<SimulationAddressOp | null>(
  null,
);

export function useSimulationAddressOp(): SimulationAddressOp {
  const op = useContext(SimulationAddressContext);
  if (op === null) {
    throw new Error(
      'useSimulationAddressOp must be used within SimulationAddressProvider',
    );
  }
  return op;
}

type Props = {
  derivationPath: string | undefined;
  /** The review screen's own title, which the header shows again after the PIN pad. */
  title: string;
  children: React.ReactNode;
};

async function exportAddress(
  cmdSet: Commandset,
  path: string | undefined,
): Promise<string> {
  if (path === undefined) {
    throw new Error('No derivation path to export');
  }
  const resp = await cmdSet.exportExtendedKey(0, path, false);
  resp.checkOK();
  const key = Keycard.BIP32KeyPair.extendedKey(resp.data);
  return pubKeyToEthAddress(key.publicKey!);
}

// Mount it as a child of the screen's root View: the sheet's PIN overlay
// fills its nearest ancestor, so anything smaller clips it.
export default function SimulationAddressProvider({
  derivationPath,
  title,
  children,
}: Props) {
  // Read-only key export: safe to re-run from SELECT on a re-tap.
  const op = useKeycardOp(exportAddress, {
    requiresPin: true,
    retryOnTagLoss: true,
  });
  const { start } = op;
  const startWithPath = useCallback(
    () => start(derivationPath),
    [start, derivationPath],
  );

  const navigation = useNavigation<KeycardScreenNavigation>();
  // Cancelling the tap keeps the review.
  const { sheet } = useKeycardScreen({
    keycard: op,
    navigation,
    title,
    stayOnCancel: true,
  });

  return (
    <SimulationAddressContext.Provider value={{ ...op, start: startWithPath }}>
      {children}
      {sheet}
    </SimulationAddressContext.Provider>
  );
}
