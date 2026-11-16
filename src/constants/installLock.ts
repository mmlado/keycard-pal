import {
  INSTALL_LOCK_PATH,
  LockCheck,
  LockFindings,
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

export const LOCK_NOT_CONFIRMED_HEADING = 'Applet installs may not be locked';
export const LOCK_NOT_FULLY_CHECKED_HEADING =
  'Applet installs locked, not fully checked';

function keysetsAt(versions: number[]): string {
  const names = versions.map(
    version => `0x${version.toString(16).toUpperCase().padStart(2, '0')}`,
  );
  const last = names.pop();
  return names.length === 0
    ? `a keyset at key version ${last}`
    : `keysets at key versions ${names.join(', ')} and ${last}`;
}

const UNCHECKED_LINES: Record<LockCheck, string> = {
  state: "The card manager's state could not be checked.",
  domains: 'The security domains could not be checked.',
  keys: "The card manager's keys could not be checked.",
};

export function lockFindingLines(findings: LockFindings): string[] {
  const lines: string[] = [];
  if (findings.notSecured) {
    lines.push(`The card manager is ${findings.notSecured}, not SECURED.`);
  }
  for (const { aid, securityDomain, privileges } of findings.otherDomains) {
    const entry = securityDomain ? 'Security domain' : 'Application';
    const names = privileges.join(', ');
    lines.push(`${entry} ${aid} can still manage applets: ${names}.`);
  }
  if (findings.otherKeyVersions.length > 0) {
    const keysets = keysetsAt(findings.otherKeyVersions);
    lines.push(
      `The card manager also has ${keysets}, which the lock did not replace.`,
    );
  }
  return [...lines, ...findings.unchecked.map(check => UNCHECKED_LINES[check])];
}

/** Only an unchecked state blocks the lock: SECURED is what makes it done. */
export function lockFindingsHeading(findings: LockFindings): string {
  const found =
    findings.notSecured !== null ||
    findings.otherDomains.length > 0 ||
    findings.otherKeyVersions.length > 0 ||
    findings.unchecked.includes('state');
  return found ? LOCK_NOT_CONFIRMED_HEADING : LOCK_NOT_FULLY_CHECKED_HEADING;
}

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
