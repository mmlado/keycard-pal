import { Commandset } from 'keycard-sdk/dist/commandset';
import { Constants } from 'keycard-sdk/dist/constants';
import { CryptoUtils } from 'keycard-sdk/dist/crypto-utils';
import { GlobalPlatformCommandset } from 'keycard-sdk/dist/global-platform-commandset';
import { GlobalPlatformConstants } from 'keycard-sdk/dist/global-platform-constants';
import { SCP02Keys } from 'keycard-sdk/dist/scp02-keys';

import { fromHex } from '@/utils/hex';
import {
  CARD_MANAGER_AID,
  INSTALL_LOCK_KEY_LENGTH,
  INSTALL_LOCK_PATH,
  PUBLISHED_CARD_MANAGER_KEYS,
  PublishedCardManagerKey,
} from '@/utils/installLock';
import { useKeycardOp } from './useKeycardOperation';

export type InstallLockRequest =
  | { action: 'lock' }
  | { action: 'unlock'; restore: PublishedCardManagerKey };

export type InstallLockOutcome =
  | 'locked'
  | 'alreadyLocked'
  | 'unlocked'
  | 'notLocked';

export const NO_CHAIN_CODE_STATUS =
  "This Keycard's key cannot derive the lock key, so nothing was changed.";
export const UNEXPECTED_LOCK_KEY_LENGTH =
  'The Keycard answered with the wrong length. Try again.';
export const NO_MATCHING_KEY_STATUS =
  "This PIN does not open this Keycard's applet installs, so nothing was " +
  'changed. They may have been locked under another PIN or with another tool.';
export const CARD_MANAGER_REFUSED_STATUS =
  "This Keycard's card manager refused the request, so nothing was changed.";

/** keycard-sdk's literal for "no keyset matched the card cryptogram"; a test holds it to the SDK. */
export const NO_MATCHING_KEYSET_MESSAGE = 'Error verifying card cryptogram';

function keyset(key: Uint8Array): SCP02Keys {
  return new SCP02Keys(key, key, key);
}

async function deriveLockKey(cmdSet: Commandset): Promise<Uint8Array> {
  const response = await cmdSet.exportBIP85(
    INSTALL_LOCK_PATH,
    INSTALL_LOCK_KEY_LENGTH,
  );
  if (response.sw === Constants.SW_CONDITIONS_OF_USE_NOT_SATISFIED) {
    throw new Error(NO_CHAIN_CODE_STATUS);
  }
  response.checkOK();
  if (response.data.length !== INSTALL_LOCK_KEY_LENGTH) {
    throw new Error(UNEXPECTED_LOCK_KEY_LENGTH);
  }
  return response.data;
}

/** Opens the card manager's channel and tells whether it answered to the lock key or a published one. */
async function openCardManager(
  cmdSet: Commandset,
  lockKeys: SCP02Keys,
): Promise<{ gp: GlobalPlatformCommandset; locked: boolean; kvn: number }> {
  const gp = new GlobalPlatformCommandset(cmdSet.apduChannel);
  (await gp.select(CARD_MANAGER_AID)).checkOK();

  const challenge = CryptoUtils.getRandomBytes(8);
  let response;
  try {
    // The development key is the commandset's own; the GlobalPlatform default is its fallback.
    response = await gp.initializeUpdate(challenge, [lockKeys]);
  } catch (e) {
    if (e instanceof Error && e.message.includes(NO_MATCHING_KEYSET_MESSAGE)) {
      throw new Error(NO_MATCHING_KEY_STATUS);
    }
    throw new Error(CARD_MANAGER_REFUSED_STATUS);
  }
  (await gp.externalAuthenticate(challenge)).checkOK();

  return {
    gp,
    locked: gp.scp02Session.staticKeys === lockKeys,
    kvn: response.data[10],
  };
}

async function secureCardManager(gp: GlobalPlatformCommandset): Promise<void> {
  // 6985: already SECURED.
  (
    await gp.setStatus(
      GlobalPlatformConstants.SET_STATUS_P1_ISD,
      GlobalPlatformConstants.CARD_LIFE_CYCLE_SECURED,
    )
  ).checkSW([Constants.SW_OK, Constants.SW_CONDITIONS_OF_USE_NOT_SATISFIED]);
}

export async function runInstallLock(
  cmdSet: Commandset,
  request: InstallLockRequest,
): Promise<InstallLockOutcome> {
  const lockKey = await deriveLockKey(cmdSet);
  try {
    const { gp, locked, kvn } = await openCardManager(cmdSet, keyset(lockKey));

    if (request.action === 'lock') {
      if (!locked) {
        (await gp.putSCP02Keys(kvn, kvn, lockKey)).checkOK();
      }
      await secureCardManager(gp);
      return locked ? 'alreadyLocked' : 'locked';
    }

    if (!locked) {
      return 'notLocked';
    }
    const published = fromHex(PUBLISHED_CARD_MANAGER_KEYS[request.restore]);
    (await gp.putSCP02Keys(kvn, kvn, published)).checkOK();
    return 'unlocked';
  } finally {
    lockKey.fill(0);
  }
}

const OPTIONS = {
  requiresPin: true,
  requiresRoute: 'InstallLock',
  refusesLeeMode: true,
} as const;

export function useLockInstalls() {
  return useKeycardOp(runInstallLock, {
    ...OPTIONS,
    successMessage: 'Applet installs locked',
  });
}

export function useUnlockInstalls() {
  return useKeycardOp(runInstallLock, {
    ...OPTIONS,
    successMessage: 'Applet installs unlocked',
  });
}
