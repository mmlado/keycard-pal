import type { Commandset } from 'keycard-sdk/dist/commandset';

import { XPUB_EXPLAINER } from '@/constants/exportKey';
import type { WCContext } from '@/constants/walletConnect';
import type { KeycardParams } from '@/navigation/types';

import {
  buildBtcSignatureUR,
  hashBitcoinMessage,
  parseKeycardBtcMessageSignature,
} from './btcMessage';
import { BtcSigningSession, buildCryptoPsbtUR } from './btcPsbt';
import {
  classifyEthPayload,
  payloadChainId,
  signingDigest,
} from './ethPayload';
import {
  buildEthSignatureURFromResult,
  buildRawEthHexSignature,
} from './ethSignature';
import { getExportTarget } from './exportTargets';
import {
  exportKeysForTarget,
  makeExportResumeCache,
  type ExportKeysResult,
} from './keycardExport';

/** A QR code to show, or a signature to answer the WalletConnect request with. */
export type FlowOutcome =
  | {
      kind: 'ur';
      urString: string;
      title: string;
      description?: string;
      doneNavigation: 'sign' | 'export';
    }
  | { kind: 'wc-signature'; rawSig: string; wcContext: WCContext };

/** Built together over the same params, so the card op and its output agree on the result. */
export type KeycardFlowRun = {
  cardOp: (
    cmdSet: Commandset,
    setStatus: (status: string) => void,
  ) => Promise<unknown>;
  buildOutput: (result: unknown) => FlowOutcome;
  /** Shown on Apple's sheet and the success sheet. */
  successMessage: string;
};

// Ties cardOp's result type to buildOutput's input, then erases it for the executor.
function flow<R>(run: {
  cardOp: (
    cmdSet: Commandset,
    setStatus: (status: string) => void,
  ) => Promise<R>;
  buildOutput: (result: R) => FlowOutcome;
  successMessage: string;
}): KeycardFlowRun {
  return run as KeycardFlowRun;
}

const SIGN_RESULT_TITLE = 'Show signature to the wallet';
const SIGNED_MESSAGE = 'Signed';

type EthSignParams = Extract<
  KeycardParams,
  { operation: 'sign'; signMode: 'eth' }
>;
type BtcPsbtParams = Extract<
  KeycardParams,
  { operation: 'sign'; signMode: 'btc' }
>;
type BtcMessageParams = Extract<
  KeycardParams,
  { operation: 'sign'; signMode: 'btc-message' }
>;
type ExportKeyParams = Extract<KeycardParams, { operation: 'export_key' }>;

function prepareEthSign(params: EthSignParams): KeycardFlowRun {
  const payload = classifyEthPayload(
    params.signData,
    params.dataType,
    params.chainId,
  );
  const chainId = payloadChainId(payload, params.chainId);
  // Throws on an invalid payload: the review shows no Sign button for one, so this is a backstop.
  const hash = signingDigest(payload);
  return flow<Uint8Array>({
    cardOp: async cmdSet => {
      const signResp = await cmdSet.signWithPath(
        hash,
        params.derivationPath,
        false,
      );
      signResp.checkOK();
      return signResp.data;
    },
    buildOutput: result => {
      if (params.wcContext) {
        return {
          kind: 'wc-signature',
          rawSig: buildRawEthHexSignature(result, hash, payload.kind, chainId),
          wcContext: params.wcContext,
        };
      }
      return {
        kind: 'ur',
        urString: buildEthSignatureURFromResult(
          result,
          hash,
          payload.kind,
          chainId,
          params.requestId,
        ),
        title: SIGN_RESULT_TITLE,
        doneNavigation: 'sign',
      };
    },
    successMessage: SIGNED_MESSAGE,
  });
}

function prepareBtcPsbtSign(params: BtcPsbtParams): KeycardFlowRun {
  // Throws on a malformed PSBT, which the review still offers to sign.
  const session = new BtcSigningSession(params.psbtHex);
  return flow<{ psbtHex: string }>({
    cardOp: async (cmdSet, setStatus) => {
      const signed = await session.signWithKeycard(cmdSet, setStatus);
      return { psbtHex: signed.psbtHex };
    },
    buildOutput: result => ({
      kind: 'ur',
      urString: buildCryptoPsbtUR(result.psbtHex),
      title: SIGN_RESULT_TITLE,
      doneNavigation: 'sign',
    }),
    successMessage: SIGNED_MESSAGE,
  });
}

function prepareBtcMessageSign(params: BtcMessageParams): KeycardFlowRun {
  const hash = hashBitcoinMessage(params.signDataHex);
  return flow<Uint8Array>({
    cardOp: async cmdSet => {
      const signResp = await cmdSet.signWithPath(
        hash,
        params.derivationPath,
        false,
      );
      signResp.checkOK();
      return signResp.data;
    },
    buildOutput: result => {
      const parsed = parseKeycardBtcMessageSignature(hash, result);
      return {
        kind: 'ur',
        urString: buildBtcSignatureUR({
          requestId: params.requestId,
          signature: parsed.signature,
          publicKey: parsed.publicKey,
        }),
        title: SIGN_RESULT_TITLE,
        doneNavigation: 'sign',
      };
    },
    successMessage: SIGNED_MESSAGE,
  });
}

function prepareExportKey(params: ExportKeyParams): KeycardFlowRun {
  const target = getExportTarget(params.target);
  // Lives with the flow, so a re-tap after a tag loss resumes at the first key not yet read.
  const resumeCache = makeExportResumeCache();
  return flow<ExportKeysResult>({
    cardOp: (cmdSet, setStatus) =>
      exportKeysForTarget(cmdSet, target.keys, setStatus, resumeCache),
    buildOutput: result => ({
      kind: 'ur',
      urString: target.buildUr(result),
      title: 'Show key to the wallet',
      description: XPUB_EXPLAINER,
      doneNavigation: 'export',
    }),
    successMessage: 'Key exported',
  });
}

/** The heavy local work happens here, before the NFC prompt; throws when the payload cannot be prepared. */
export function prepareKeycardFlow(params: KeycardParams): KeycardFlowRun {
  if (params.operation === 'export_key') {
    return prepareExportKey(params);
  }
  if (params.signMode === 'eth') {
    return prepareEthSign(params);
  }
  if (params.signMode === 'btc-message') {
    return prepareBtcMessageSign(params);
  }
  return prepareBtcPsbtSign(params);
}
