// ERC-8213 is still an open pull request against ethereum/ERCs, so the PR is
// the only page that renders the spec.
export const ERC8213_URL = 'https://github.com/ethereum/ERCs/pull/1639';
export const ERC8213_LINK_LABEL = 'What is ERC-8213?';
export const ERC8213_QR_TITLE = 'ERC-8213';

export const CALLDATA_DIGEST_EXPLAINER =
  'A digest is a short fingerprint of what you are about to sign. This one ' +
  'covers the transaction calldata. Compare it with the digest shown by the ' +
  'app that created the request: if they match, the call reached your ' +
  'Keycard unchanged.';

export const EIP712_DIGEST_EXPLAINER =
  'A digest is a short fingerprint of what you are about to sign. This one ' +
  'is the 32-byte value your Keycard signs. Compare it with the digest shown ' +
  'by the app that created the request: if they match, you are signing what ' +
  'it asked for.';
