/* eslint-disable no-bitwise */
import { Commandset } from 'keycard-sdk/dist/commandset';
import { Constants } from 'keycard-sdk/dist/constants';
import { CryptoUtils } from 'keycard-sdk/dist/crypto-utils';
import { GlobalPlatformCommandset } from 'keycard-sdk/dist/global-platform-commandset';
import { GlobalPlatformConstants } from 'keycard-sdk/dist/global-platform-constants';
import { Identifiers } from 'keycard-sdk/dist/identifiers';
import { SCP02Keys } from 'keycard-sdk/dist/scp02-keys';

import {
  RegistryEntry,
  cardLifeCycleName,
  isSecurityDomain,
  listsEveryDomain,
  managementPrivileges,
  registryEntries,
} from '@/utils/gpRegistry';
import { fromHex, toHex } from '@/utils/hex';
import {
  CARD_MANAGER_AID,
  INSTALL_LOCK_KEY_LENGTH,
  INSTALL_LOCK_PATH,
  LockCheck,
  LockFindings,
  PUBLISHED_CARD_MANAGER_KEYS,
  PublishedCardManagerKey,
} from '@/utils/installLock';
import { keysetVersions } from '@/utils/keyInformationTemplate';
import { isTagLostError } from '@/utils/keycardErrors';
import { useKeycardOp } from './useKeycardOperation';

export type InstallLockRequest =
  | { action: 'lock' }
  | { action: 'unlock'; restore: PublishedCardManagerKey };

/** 'lock' is the key derived from the card; the others are published. */
export type CardManagerKey = 'lock' | PublishedCardManagerKey;

export type InstallLockResult =
  | {
      outcome: 'locked' | 'alreadyLocked' | 'unlocked' | 'notLocked';
      /** The key the card manager answers to once the tap is over. */
      cardManagerKey: CardManagerKey;
    }
  | {
      outcome: 'unconfirmed';
      cardManagerKey: 'lock';
      findings: LockFindings;
    };

export const NO_CHAIN_CODE_STATUS =
  "This Keycard's key cannot derive the lock key, so nothing was changed.";
export const UNEXPECTED_LOCK_KEY_LENGTH =
  'The Keycard answered with the wrong length. Try again.';
export const NO_MATCHING_KEY_STATUS =
  "No key Keycard Pal knows opens this Keycard's card manager, so nothing " +
  'was changed. It may be a retail Keycard, or locked under another ' +
  'recovery phrase or PIN, or with another tool.';
export const CARD_MANAGER_REFUSED_STATUS =
  "This Keycard's card manager refused the request, so nothing was changed.";
export const CARD_MANAGER_BLOCKED_STATUS =
  "This Keycard's card manager has blocked its key after too many failed " +
  'attempts, so nothing was changed. Its applet installs can no longer be ' +
  'changed.';

/** keycard-sdk's literal for "no keyset matched the card cryptogram"; a test holds it to the SDK. */
export const NO_MATCHING_KEYSET_MESSAGE = 'Error verifying card cryptogram';

const INITIAL_KEY_VERSION = 0xff;
const SW_MORE_DATA = 0x6310;
const MAX_STATUS_ANSWERS = 16;

function keyset(key: Uint8Array): SCP02Keys {
  return new SCP02Keys(key, key, key);
}

/** P1 and the new key version of a PUT KEY that replaces the keyset the card answered with. */
function putKeyVersions(kvn: number): [number, number] {
  // The initial keyset is replaced by adding version 1, as the SDK's own key upgrade does.
  return kvn === INITIAL_KEY_VERSION ? [0, 1] : [kvn, kvn];
}

async function deriveLockKey(cmdSet: Commandset): Promise<Uint8Array> {
  const response = await cmdSet.exportBIP85(
    INSTALL_LOCK_PATH,
    INSTALL_LOCK_KEY_LENGTH,
  );
  try {
    if (response.sw === Constants.SW_CONDITIONS_OF_USE_NOT_SATISFIED) {
      throw new Error(NO_CHAIN_CODE_STATUS);
    }
    response.checkOK();
    if (response.data.length !== INSTALL_LOCK_KEY_LENGTH) {
      throw new Error(UNEXPECTED_LOCK_KEY_LENGTH);
    }
    return new Uint8Array(response.data);
  } finally {
    // The answer holds the key twice: its data is a copy of the raw buffer.
    response.data.fill(0);
    response.apdu.fill(0);
  }
}

/** A card's refusal in plain words; a lost card keeps its own error for the session to classify. */
function cardManagerRefusal(e: unknown): unknown {
  if (isTagLostError(e)) {
    return e;
  }
  if (e instanceof Error && e.message.includes(NO_MATCHING_KEYSET_MESSAGE)) {
    return new Error(NO_MATCHING_KEY_STATUS);
  }
  const sw = (e as { sw?: unknown } | null)?.sw;
  if (sw === Constants.SW_AUTHENTICATION_METHOD_BLOCKED) {
    return new Error(CARD_MANAGER_BLOCKED_STATUS);
  }
  if (typeof sw === 'number') {
    return new Error(CARD_MANAGER_REFUSED_STATUS);
  }
  return e;
}

/** Opens the card manager's channel with whichever known key its cryptogram matched. */
async function openCardManager(
  cmdSet: Commandset,
  lockKeys: SCP02Keys,
): Promise<{
  gp: GlobalPlatformCommandset;
  cardManagerKey: CardManagerKey;
  kvn: number;
}> {
  const gp = new GlobalPlatformCommandset(cmdSet.apduChannel);
  const challenge = CryptoUtils.getRandomBytes(8);
  let response;
  try {
    (await gp.select(CARD_MANAGER_AID)).checkOK();
    // The development key is the commandset's own; the GlobalPlatform default is its fallback.
    response = await gp.initializeUpdate(challenge, [lockKeys]);
  } catch (e) {
    throw cardManagerRefusal(e);
  }
  (await gp.externalAuthenticate(challenge)).checkOK();

  const { staticKeys, fallbackKeys } = gp.scp02Session;
  let cardManagerKey: CardManagerKey = 'keycardDevelopment';
  if (staticKeys === lockKeys) {
    cardManagerKey = 'lock';
  } else if (fallbackKeys) {
    cardManagerKey = 'gpDefault';
  }
  return { gp, cardManagerKey, kvn: response.data[10] };
}

/** Through INITIALIZED, since not every card takes OP_READY straight to SECURED. 6985: already past it. */
async function secureCardManager(gp: GlobalPlatformCommandset): Promise<void> {
  for (const state of [
    GlobalPlatformConstants.CARD_LIFE_CYCLE_INITIALIZED,
    GlobalPlatformConstants.CARD_LIFE_CYCLE_SECURED,
  ]) {
    (
      await gp.setStatus(GlobalPlatformConstants.SET_STATUS_P1_ISD, state)
    ).checkSW([Constants.SW_OK, Constants.SW_CONDITIONS_OF_USE_NOT_SATISFIED]);
  }
}

/** A refused PUT KEY changed nothing, so it gets the refusal wording too. */
async function putKey(
  gp: GlobalPlatformCommandset,
  [oldKvn, newKvn]: [number, number],
  key: Uint8Array,
): Promise<void> {
  try {
    (await gp.putSCP02Keys(oldKvn, newKvn, key)).checkOK();
  } catch (e) {
    throw cardManagerRefusal(e);
  }
}

const sameAid = (a: Uint8Array, b: Uint8Array) => toHex(a) === toHex(b);

/** Null unless the card answers the whole query; the loop is bounded against a card that never stops. */
async function readRegistry(
  gp: GlobalPlatformCommandset,
  p1: number,
): Promise<RegistryEntry[] | null> {
  const data: number[] = [];
  let p2 = GlobalPlatformConstants.GET_STATUS_P2_TLV;
  for (let answer = 0; answer < MAX_STATUS_ANSWERS; answer++) {
    const response = await gp.getStatus(p1, p2);
    if (response.sw !== Constants.SW_OK && response.sw !== SW_MORE_DATA) {
      return null;
    }
    data.push(...response.data);
    if (response.sw === Constants.SW_OK) {
      return registryEntries(new Uint8Array(data));
    }
    // The card manager's own entry has no next occurrence.
    if (
      p1 === GlobalPlatformConstants.GET_STATUS_P1_ISD ||
      response.data.length === 0
    ) {
      return null;
    }
    p2 =
      GlobalPlatformConstants.GET_STATUS_P2_TLV |
      GlobalPlatformConstants.GET_STATUS_P2_NEXT;
  }
  return null;
}

async function cardManagerEntry(
  gp: GlobalPlatformCommandset,
): Promise<RegistryEntry | null> {
  const entries = await readRegistry(
    gp,
    GlobalPlatformConstants.GET_STATUS_P1_ISD,
  );
  return entries?.length === 1 && sameAid(entries[0].aid, CARD_MANAGER_AID)
    ? entries[0]
    : null;
}

/** Every managing entry the card lists, even when the list cannot be trusted to be whole. */
async function otherManagingDomains(
  gp: GlobalPlatformCommandset,
  cardManager: RegistryEntry,
): Promise<{ domains: LockFindings['otherDomains']; complete: boolean }> {
  const entries = await readRegistry(
    gp,
    GlobalPlatformConstants.GET_STATUS_P1_APPLICATIONS,
  );
  const domains: LockFindings['otherDomains'] = [];
  // Without Global Registry, or without this tap's applet, the list may not be the whole card.
  let complete =
    entries !== null &&
    listsEveryDomain(cardManager.privileges) &&
    entries.some(entry => sameAid(entry.aid, Identifiers.KEYCARD_INSTANCE_ID));
  for (const entry of entries ?? []) {
    if (sameAid(entry.aid, cardManager.aid)) {
      continue;
    }
    const privileges = managementPrivileges(entry.privileges);
    if (privileges === null) {
      complete = false;
    } else if (privileges.length > 0) {
      domains.push({
        aid: toHex(entry.aid).toUpperCase(),
        securityDomain: isSecurityDomain(entry.privileges),
        privileges,
      });
    }
  }
  return { domains, complete };
}

/** GET STATUS needs the session, so it comes before the new SELECT of the key list. */
async function lockFindings(
  gp: GlobalPlatformCommandset,
  lockKvn: number,
): Promise<LockFindings> {
  const unchecked: LockCheck[] = [];
  const cardManager = await cardManagerEntry(gp);
  const state = cardManager && cardLifeCycleName(cardManager.lifeCycle);
  if (!state) {
    unchecked.push('state');
  }
  const domainCheck = cardManager
    ? await otherManagingDomains(gp, cardManager)
    : null;
  if (!domainCheck?.complete) {
    unchecked.push('domains');
  }
  const otherKeyVersions = await otherKeysets(gp, lockKvn);
  if (!otherKeyVersions) {
    unchecked.push('keys');
  }
  return {
    notSecured: state && state !== 'SECURED' ? state : null,
    otherDomains: domainCheck?.domains ?? [],
    otherKeyVersions: otherKeyVersions ?? [],
    unchecked,
  };
}

const confirmsLock = (findings: LockFindings) =>
  findings.notSecured === null &&
  findings.otherDomains.length === 0 &&
  findings.otherKeyVersions.length === 0 &&
  findings.unchecked.length === 0;

async function otherKeysets(
  gp: GlobalPlatformCommandset,
  lockKvn: number,
): Promise<number[] | null> {
  // A new SELECT ends the session first: a plain command inside it would abort it.
  if ((await gp.select(CARD_MANAGER_AID)).sw !== Constants.SW_OK) {
    return null;
  }
  const response = await gp.getData(
    GlobalPlatformConstants.GET_DATA_KEY_INFORMATION_TEMPLATE,
  );
  const versions =
    response.sw === Constants.SW_OK ? keysetVersions(response.data) : null;
  // A list without the key just written does not describe this card manager.
  if (!versions?.includes(lockKvn)) {
    return null;
  }
  return versions.filter(version => version !== lockKvn);
}

export async function runInstallLock(
  cmdSet: Commandset,
  request: InstallLockRequest,
): Promise<InstallLockResult> {
  const lockKey = await deriveLockKey(cmdSet);
  try {
    const { gp, cardManagerKey, kvn } = await openCardManager(
      cmdSet,
      keyset(lockKey),
    );
    const putVersions = putKeyVersions(kvn);
    const [, newKvn] = putVersions;

    if (request.action === 'lock') {
      const locked = cardManagerKey === 'lock';
      if (!locked) {
        await putKey(gp, putVersions, lockKey);
      }
      await secureCardManager(gp);
      const findings = await lockFindings(gp, locked ? kvn : newKvn);
      if (!confirmsLock(findings)) {
        return { outcome: 'unconfirmed', cardManagerKey: 'lock', findings };
      }
      return {
        outcome: locked ? 'alreadyLocked' : 'locked',
        cardManagerKey: 'lock',
      };
    }

    if (cardManagerKey !== 'lock') {
      return { outcome: 'notLocked', cardManagerKey };
    }
    const published = fromHex(PUBLISHED_CARD_MANAGER_KEYS[request.restore]);
    await putKey(gp, putVersions, published);
    return { outcome: 'unlocked', cardManagerKey: request.restore };
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
