import { useCallback, useEffect, useRef, useState } from 'react';
import Keycard from 'keycard-sdk';

import type { EthSignRequest } from '@/types';
import type { ParsedTx } from '@/utils/txParser';

import { useKeycardOp } from '@/hooks/keycard/useKeycardOperation';
import { useTenderlyConfig } from '@/hooks/useTenderlyConfig.online';
import { simulateTransaction } from '@/utils/tenderly/client.online';
import { pubKeyToEthAddress } from '@/utils/ethereumAddress';

import type { SimulationState } from './SimulationPanel';

export function useSimulation(
  request: EthSignRequest,
  tx: ParsedTx,
  chainId: number | undefined,
) {
  const { credentials } = useTenderlyConfig();

  const [simulationState, setSimulationState] = useState<SimulationState>({
    phase: 'idle',
  });
  const [cachedAddress, setCachedAddress] = useState<string | null>(
    request.address ?? null,
  );

  useEffect(() => {
    setCachedAddress(request.address ?? null);
    setSimulationState({ phase: 'idle' });
  }, [request.address, tx.to, tx.data, tx.valueWei, chainId]);

  const simulationRunIdRef = useRef(0);

  const derivationPathRef = useRef(request.derivationPath);
  derivationPathRef.current = request.derivationPath;
  const credentialsRef = useRef(credentials);
  credentialsRef.current = credentials;
  const txRef = useRef(tx);
  txRef.current = tx;
  const chainIdRef = useRef(chainId);
  chainIdRef.current = chainId;

  const runSimulation = useCallback(async (from: string) => {
    const runId = ++simulationRunIdRef.current;
    const creds = credentialsRef.current;
    const currentTx = txRef.current;
    if (!creds || !currentTx.to) return;
    setSimulationState({ phase: 'loading' });
    try {
      const gasLimit =
        currentTx.fees.kind !== 'unknown' ? currentTx.fees.gasLimit : '21000';
      const result = await simulateTransaction(creds, {
        from,
        to: currentTx.to,
        valueWei: currentTx.valueWei ?? '0',
        data: currentTx.data ?? '0x',
        gasLimit,
        chainId: chainIdRef.current!,
      });
      if (runId !== simulationRunIdRef.current) return;
      setSimulationState({ phase: 'result', data: result });
    } catch (e) {
      if (runId !== simulationRunIdRef.current) return;
      setSimulationState({
        phase: 'error',
        message: e instanceof Error ? e.message : 'Simulation failed',
      });
    }
  }, []);

  const addressOp = useKeycardOp<string>(
    useCallback(async cmdSet => {
      const resp = await cmdSet.exportExtendedKey(
        0,
        derivationPathRef.current,
        false,
      );
      resp.checkOK();
      const key = Keycard.BIP32KeyPair.extendedKey(resp.data);
      return pubKeyToEthAddress(key.publicKey!);
    }, []),
    { requiresPin: true },
  );

  const {
    phase: addressPhase,
    result: addressResult,
    cancel: cancelAddress,
  } = addressOp;

  useEffect(() => {
    if (addressPhase !== 'done' || !addressResult) return;
    setCachedAddress(addressResult);
    runSimulation(addressResult);
  }, [addressPhase, addressResult, runSimulation]);

  const handleSimulate = useCallback(() => {
    if (cachedAddress) {
      runSimulation(cachedAddress);
    } else {
      addressOp.start();
    }
  }, [cachedAddress, addressOp, runSimulation]);

  const handleCancelNfc = useCallback(() => {
    cancelAddress();
  }, [cancelAddress]);

  const showSimulationTab =
    credentials !== null && tx.to !== undefined && chainId !== undefined;

  return {
    showSimulationTab,
    simulationState,
    addressOp,
    handleSimulate,
    handleCancelNfc,
  };
}
