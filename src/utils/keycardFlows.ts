import type { Commandset } from 'keycard-sdk/dist/commandset';

import { XPUB_EXPLAINER } from '@/constants/exportKey';
import type { KeycardParams } from '@/navigation/types';

import {
  buildBtcSignatureUR,
  hashBitcoinMessage,
  parseKeycardBtcMessageSignature,
} from './btcMessage';
import { BtcSigningSession, buildCryptoPsbtUR } from './btcPsbt';
import { classifyEthPayload, signingDigest } from './ethPayload';
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

/**
 * What happens after the card operation succeeds. 'ur' outcomes navigate to
 * QRResult (via the sign or export reset stack); 'wc-signature' outcomes are
 * responded to the WalletConnect relay instead of showing a QR.
 */
export type FlowOutcome =
  | {
      kind: 'ur';
      urString: string;
      title: string;
      description?: string;
      doneNavigation: 'sign' | 'export';
    }
  | { kind: 'wc-signature'; rawSig: string };

/**
 * One Keycard operation, prepared and ready to run: the card op and the
 * completion that consumes its result are created together as a closure pair
 * over the same narrowed params, so they can never disagree about what the
 * result means — no shape-sniffing, no casts at the consumer.
 */
export type KeycardFlowRun = {
  cardOp: (
    cmdSet: Commandset,
    setStatus: (status: string) => void,
  ) => Promise<unknown>;
  buildOutput: (result: unknown) => FlowOutcome;
};

// Internal helper: ties cardOp's result type to buildOutput's input type,
// then erases it for the generic executor.
function flow<R>(run: {
  cardOp: (
    cmdSet: Commandset,
    setStatus: (status: string) => void,
  ) => Promise<R>;
  buildOutput: (result: R) => FlowOutcome;
}): KeycardFlowRun {
  return run as KeycardFlowRun;
}

const SIGN_RESULT_TITLE = 'Show signature to the wallet';

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
  const payload = classifyEthPayload(params.signData, params.dataType);
  // signingDigest throws on 'invalid' with the classification reason —
  // buildSignKeycardParams withholds the Sign button for these, so this is
  // a belt-and-braces guard, surfaced as a prepare error.
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
          rawSig: buildRawEthHexSignature(
            result,
            hash,
            payload.kind,
            params.chainId,
          ),
        };
      }
      return {
        kind: 'ur',
        urString: buildEthSignatureURFromResult(
          result,
          hash,
          payload.kind,
          params.chainId,
          params.requestId,
        ),
        title: SIGN_RESULT_TITLE,
        doneNavigation: 'sign',
      };
    },
  });
}

function prepareBtcPsbtSign(params: BtcPsbtParams): KeycardFlowRun {
  // Throws on a malformed PSBT — the review keeps its Sign button on
  // unparseable PSBTs by design, so this is the path that catches them.
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
  });
}

function prepareExportKey(params: ExportKeyParams): KeycardFlowRun {
  const target = getExportTarget(params.target);
  // Captured by the cardOp closure, so it survives reconnects within this
  // screen visit: a tag loss mid-export resumes at the first key not yet
  // fetched instead of re-exporting all of them (shorter re-tap, less chance
  // of a second loss). Same-card only — the cache self-invalidates on UID
  // change — and it dies with the flow, never outliving the screen.
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
  });
}

/**
 * Prepare the flow for a Keycard route: all heavy local work (payload
 * classification, hashing, PSBT parsing) happens here, BEFORE the NFC prompt
 * opens. Throws when the payload cannot be prepared — callers surface the
 * error instead of opening the PIN pad.
 */
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
