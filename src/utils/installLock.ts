import type { ManagementPrivilege } from './gpRegistry';

/** BIP85 HEX, 16 bytes, at the index "GPLK" in ASCII (ADR-0018). A lock opens only under this path. */
export const INSTALL_LOCK_PATH = "m/83696968'/128169'/16'/1196444747'";
export const INSTALL_LOCK_KEY_LENGTH = 16;

/** The GlobalPlatform card manager of a JCOP card. */
export const CARD_MANAGER_AID = new Uint8Array([
  0xa0, 0x00, 0x00, 0x01, 0x51, 0x00, 0x00, 0x00,
]);

/** The card manager keys anyone may know: what an unlocked Developer card uses. */
export type PublishedCardManagerKey = 'gpDefault' | 'keycardDevelopment';

export const PUBLISHED_CARD_MANAGER_KEYS: Record<
  PublishedCardManagerKey,
  string
> = {
  gpDefault: '404142434445464748494a4b4c4d4e4f',
  keycardDevelopment: 'c212e073ff8b4bbfaff4de8ab655221f',
};

export type LockCheck = 'state' | 'domains' | 'keys';

export type LockFindings = {
  notSecured: string | null;
  otherDomains: {
    aid: string;
    securityDomain: boolean;
    privileges: ManagementPrivilege[];
  }[];
  otherKeyVersions: number[];
  unchecked: LockCheck[];
};
