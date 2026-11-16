import {
  INSTALL_LOCK_PATH,
  PublishedCardManagerKey,
} from '@/utils/installLock';

export const LOCK_INSTALLS_TITLE = 'Lock applet installs';
export const UNLOCK_INSTALLS_TITLE = 'Unlock applet installs';

export const LOCK_INSTALLS_INTRO =
  "Only someone with this card's PIN can then replace or remove the Keycard applet.";

export const LOCK_INSTALLS_POINTS = [
  "The first lock also moves the card to its final setup state. That step can't be undone; installing with the right key still works.",
  'Unlock with the same PIN you lock with.',
  `Keep your recovery phrase. If the card is reset, the phrase is the only way to unlock installs: BIP85 HEX, 16 bytes, at ${INSTALL_LOCK_PATH}.`,
];

export const ALREADY_LOCKED_TOAST = 'Applet installs were already locked';

export const OTHER_KEYSETS_HEADING = 'Applet installs may not be locked';

function keysetsAt(versions: number[]): string {
  const names = versions.map(
    version => `0x${version.toString(16).toUpperCase().padStart(2, '0')}`,
  );
  const last = names.pop();
  return names.length === 0
    ? `a keyset at key version ${last}`
    : `keysets at key versions ${names.join(', ')} and ${last}`;
}

export function otherKeysetsDetail(versions: number[]): string {
  const keysets = keysetsAt(versions);
  return `The card manager also has ${keysets}, which the lock did not replace. Whoever holds those keys may still be able to replace or remove the Keycard applet.`;
}

export const otherKeysetsToast = (versions: number[]) =>
  `Lock not confirmed: the card also has ${keysetsAt(versions)}`;

export const KEYSETS_UNCHECKED_HEADING =
  'Applet installs locked, keys not checked';
export const KEYSETS_UNCHECKED_DETAIL =
  "Keycard Pal couldn't read a key list from the card manager that shows the lock's key, so it couldn't check whether another keyset can still replace or remove the Keycard applet.";

export const UNLOCK_INSTALLS_INTRO =
  'Unlocking puts a published key back, so any tool can replace or remove the Keycard applet. Pick the key your install tool expects.';

export const UNLOCK_KEY_CHOICES = {
  gpDefault: {
    label: 'GlobalPlatform default',
    detail: "Works with GlobalPlatformPro and most tools, Keycard's included.",
  },
  keycardDevelopment: {
    label: 'Keycard development key',
    detail: "The key Keycard's own install tools use first.",
  },
} as const;

export const UNLOCKED_HEADING = 'Applet installs unlocked';
export const NOT_LOCKED_HEADING = 'Applet installs were not locked';

export const NOT_LOCKED_DETAIL: Record<PublishedCardManagerKey, string> = {
  gpDefault: 'Its card manager already uses the GlobalPlatform default key.',
  keycardDevelopment:
    'Its card manager already uses the Keycard development key.',
};

export const UPDATE_STEPS_HEADING = 'To update the Keycard applet:';

export const UPDATE_STEPS = [
  "Install the new applet with Keycard's CLI or Gradle. This erases the card.",
  'Give the card an identity (keycard load-ident). Until then it answers nothing.',
  'Initialize it and load your recovery phrase in Keycard Pal.',
  'Approve the card again: its new identity makes it a new card to the app.',
  'Lock applet installs again. The same phrase gives the same lock key.',
];

export const KEYCARD_BUILD_GUIDE_URL =
  'https://docs.keycard.tech/en/developers/build';
export const KEYCARD_BUILD_GUIDE_LABEL = "Keycard's build guide";
