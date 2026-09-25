import React, { createContext, useCallback, useContext, useRef } from 'react';
import Keycard from 'keycard-sdk';

import NFCBottomSheet from '@/components/NFCBottomSheet';

import { useKeycardOp } from '@/hooks/keycard/useKeycardOperation';

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
  children: React.ReactNode;
};

// Mount it as a child of the screen's root View: the sheet's PIN overlay
// fills its nearest ancestor, so anything smaller clips it.
export default function SimulationAddressProvider({
  derivationPath,
  children,
}: Props) {
  const derivationPathRef = useRef(derivationPath);
  derivationPathRef.current = derivationPath;

  const op = useKeycardOp<string>(
    useCallback(async cmdSet => {
      const path = derivationPathRef.current;
      if (path === undefined) {
        throw new Error('No derivation path to export');
      }
      const resp = await cmdSet.exportExtendedKey(0, path, false);
      resp.checkOK();
      const key = Keycard.BIP32KeyPair.extendedKey(resp.data);
      return pubKeyToEthAddress(key.publicKey!);
    }, []),
    // Read-only key export: safe to re-run from SELECT on a re-tap.
    { requiresPin: true, retryOnTagLoss: true },
  );

  return (
    <SimulationAddressContext.Provider value={op}>
      {children}
      <NFCBottomSheet nfc={op} onCancel={op.cancel} />
    </SimulationAddressContext.Provider>
  );
}
