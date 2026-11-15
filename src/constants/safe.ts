// MultiSend and MultiSendCallOnly deployments by version, from safe-global/safe-deployments.
export const SAFE_MULTI_SEND_VERSIONS: ReadonlyMap<string, string> = new Map([
  ['0x8d29be29923b68abfdd21e541b9374737b49cdad', '1.1.1'],
  ['0xa238cbeb142c10ef7ad8442c6d1f9e89e07e7761', '1.3.0'],
  ['0x998739bfdaadde7c933b942a68053933098f9eda', '1.3.0'],
  ['0x0dfcccb95225ffb03c6fbb2559b530c2b7c8a912', '1.3.0'],
  ['0x40a2accbd92bca938b02010e17a5b8929b49130d', '1.3.0'],
  ['0xa1dabef33b3b82c7814b6d82a79e50f4ac44102b', '1.3.0'],
  ['0xf220d3b4dfb23c4ade8c88e526c1353abacbc38f', '1.3.0'],
  ['0x38869bf66a61cf6bdb996a6ae40d5853fd43b526', '1.4.1'],
  ['0x309d0b190fecca8e1d5d8309a16f7e3cb133e885', '1.4.1'],
  ['0x9641d764fc13c8b624c04430c7356c1c7c8102e2', '1.4.1'],
  ['0x0408ef011960d02349d50286d20531229bcef773', '1.4.1'],
  ['0x218543288004cd07832472d464648173c77d7eb7', '1.5.0'],
  ['0xa83c336b20401af773b6219ba5027174338d1836', '1.5.0'],
]);

export const UNKNOWN_MULTI_SEND_WARNING = 'Not a known Safe MultiSend contract';

export const DELEGATE_CALL_WARNING =
  "Delegate call: this contract's code runs as the Safe, with access to all its funds and settings";

export const ZERO_ADDRESS_CALL_WARNING =
  'MultiSend 1.5.0 sends a call to the zero address to the Safe itself';
