/* eslint-disable no-bitwise */
import { readTlv } from './berTlv';

const ENTRY_TAG = 0xe3;
const AID_TAG = 0x4f;
const LIFE_CYCLE_TAG = 0x9f70;
const PRIVILEGES_TAG = 0xc5;
const READ_TAGS = [AID_TAG, LIFE_CYCLE_TAG, PRIVILEGES_TAG];

export type RegistryEntry = {
  aid: Uint8Array;
  lifeCycle: number;
  /** Three bytes, or one on a card that answers with the older single byte. */
  privileges: Uint8Array;
};

/** GP Card Specification 2.3.1, Table 11-6. */
const CARD_LIFE_CYCLES = new Map([
  [0x01, 'OP_READY'],
  [0x07, 'INITIALIZED'],
  [0x0f, 'SECURED'],
  [0x7f, 'CARD_LOCKED'],
  [0xff, 'TERMINATED'],
]);

export const cardLifeCycleName = (lifeCycle: number): string | null =>
  CARD_LIFE_CYCLES.get(lifeCycle) ?? null;

export type ManagementPrivilege =
  | 'Authorized Management'
  | 'Delegated Management'
  | 'Global Delete';

/** The privileges that let a domain remove or replace an applet (GP 2.3.1, Tables 11-7 and 11-8). */
const MANAGEMENT_PRIVILEGES: [ManagementPrivilege, number, number][] = [
  ['Authorized Management', 1, 0x40],
  ['Delegated Management', 0, 0xa0],
  ['Global Delete', 1, 0x10],
];

const GLOBAL_REGISTRY: [number, number] = [1, 0x04];
const SECURITY_DOMAIN: [number, number] = [0, 0x80];

const hasBits = (privileges: Uint8Array, [byte, bits]: [number, number]) =>
  (privileges[byte] & bits) === bits;

/** Strict: findings are drawn from it, so an answer GlobalPlatform does not allow is no answer. */
export function registryEntries(data: Uint8Array): RegistryEntry[] | null {
  const entries: RegistryEntry[] = [];
  const aids = new Set<string>();
  for (let offset = 0; offset < data.length; ) {
    const entry = readTlv(data, offset);
    if (!entry || entry.tag !== ENTRY_TAG) {
      return null;
    }
    offset = entry.end;
    const fields = new Map<number, Uint8Array>();
    for (let at = 0; at < entry.value.length; ) {
      const field = readTlv(entry.value, at);
      if (!field) {
        return null;
      }
      at = field.end;
      if (!READ_TAGS.includes(field.tag)) {
        continue;
      }
      if (fields.has(field.tag)) {
        return null;
      }
      fields.set(field.tag, field.value);
    }
    const aid = fields.get(AID_TAG);
    const lifeCycle = fields.get(LIFE_CYCLE_TAG);
    const privileges = fields.get(PRIVILEGES_TAG);
    if (
      !aid ||
      aid.length < 5 ||
      aid.length > 16 ||
      lifeCycle?.length !== 1 ||
      (privileges?.length !== 1 && privileges?.length !== 3)
    ) {
      return null;
    }
    const aidKey = aid.join(',');
    if (aids.has(aidKey)) {
      return null;
    }
    aids.add(aidKey);
    entries.push({ aid, lifeCycle: lifeCycle[0], privileges });
  }
  return entries;
}

/** Null when the privileges are the older single byte, which cannot show them. */
export function managementPrivileges(
  privileges: Uint8Array,
): ManagementPrivilege[] | null {
  if (privileges.length !== 3) {
    return null;
  }
  return MANAGEMENT_PRIVILEGES.filter(([, byte, bits]) =>
    hasBits(privileges, [byte, bits]),
  ).map(([name]) => name);
}

/** Without Global Registry the card manager lists only its own hierarchy. */
export function listsEveryDomain(privileges: Uint8Array): boolean {
  return privileges.length === 3 && hasBits(privileges, GLOBAL_REGISTRY);
}

export function isSecurityDomain(privileges: Uint8Array): boolean {
  return hasBits(privileges, SECURITY_DOMAIN);
}
