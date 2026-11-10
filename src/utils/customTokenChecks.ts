import {
  ADDRESS_CHECKSUM_ERROR,
  ADDRESS_FORMAT_ERROR,
  ADDRESS_ZERO_ERROR,
  ALREADY_ADDED_ERROR,
  CHAIN_ID_ERROR,
  CUSTOM_TOKEN_CAPTION,
  DECIMALS_ERROR,
  DECIMALS_NOTE,
  SYMBOL_ERROR,
} from '@/constants/customTokens';

import { getChainName, isKnownChain } from '@/utils/chainMetadata';
import {
  addressProblem,
  findCustomToken,
  getCustomTokens,
  isValidSymbol,
  parseChainId,
  parseDecimals,
  type CustomToken,
} from '@/utils/customTokens';
import {
  bundledSymbolOnChain,
  lookupBundledToken,
  type TokenMetadata,
} from '@/utils/tokenMetadata';

const ADDRESS_ERRORS = {
  format: ADDRESS_FORMAT_ERROR,
  checksum: ADDRESS_CHECKSUM_ERROR,
  zero: ADDRESS_ZERO_ERROR,
};

const COMMON_DECIMALS = 18;

export const bundledTokenText = (token: TokenMetadata) =>
  `Keycard Pal already knows this token as ${token.symbol} (${token.decimals} decimals).`;

export const shadowedText = (token: TokenMetadata) =>
  `Not used: Keycard Pal now knows this token as ${token.symbol}.`;

export const unknownChainNote = (chainId: number) =>
  `Keycard Pal does not know chain ${chainId}.`;

/** Two tokens on one chain with one symbol is how a fake token passes for a real one. */
export function duplicateSymbolWarning(
  chainId: number,
  address: string,
  symbol: string,
): string | null {
  const lower = symbol.toLowerCase();
  const own = address.toLowerCase();
  const taken =
    bundledSymbolOnChain(chainId, symbol) ||
    getCustomTokens().some(
      t =>
        t.chainId === chainId &&
        t.address !== own &&
        t.symbol.toLowerCase() === lower,
    );
  return taken
    ? `Another token on ${getChainName(
        chainId,
      )} uses the symbol ${symbol}. Check the contract address.`
    : null;
}

/** What a review row adds when its symbol is the user's own. */
export function customTokenRemarks(
  token: TokenMetadata | null | undefined,
  chainId: number | undefined,
  address: string,
): { caption?: string; warnings: string[] } {
  if (!token?.custom) return { warnings: [] };
  const warning =
    chainId === undefined
      ? null
      : duplicateSymbolWarning(chainId, address, token.symbol);
  return {
    caption: CUSTOM_TOKEN_CAPTION,
    warnings: warning ? [warning] : [],
  };
}

export type CustomTokenDraft = {
  chainId: string;
  address: string;
  symbol: string;
  decimals: string;
};

export type DraftField = keyof CustomTokenDraft;

export type DraftCheck = {
  /** Null until every field is acceptable. */
  token: CustomToken | null;
  errors: Partial<Record<DraftField, string>>;
  notes: Partial<Record<DraftField, string>>;
  duplicateSymbol: string | null;
  /** A custom token already at this chain and address. */
  existing: CustomToken | null;
};

/** `editing`: chain and address are the saved token's own and stay as they are. */
export function checkCustomTokenDraft(
  draft: CustomTokenDraft,
  editing: boolean,
): DraftCheck {
  const errors: DraftCheck['errors'] = {};
  const notes: DraftCheck['notes'] = {};

  const chainId = parseChainId(draft.chainId);
  if (chainId === null) {
    errors.chainId = CHAIN_ID_ERROR;
  } else {
    notes.chainId = isKnownChain(chainId)
      ? getChainName(chainId)
      : unknownChainNote(chainId);
  }

  const problem = addressProblem(draft.address);
  let existing: CustomToken | null = null;
  if (problem) {
    errors.address = ADDRESS_ERRORS[problem];
  } else if (chainId !== null) {
    const bundled = lookupBundledToken(chainId, draft.address);
    if (editing) {
      if (bundled) notes.address = shadowedText(bundled);
    } else if (bundled) {
      errors.address = bundledTokenText(bundled);
    } else {
      existing = findCustomToken(chainId, draft.address);
      if (existing) errors.address = ALREADY_ADDED_ERROR;
    }
  }

  const symbolOk = isValidSymbol(draft.symbol);
  if (!symbolOk) errors.symbol = SYMBOL_ERROR;

  const decimals = parseDecimals(draft.decimals);
  if (decimals === null) {
    errors.decimals = DECIMALS_ERROR;
  } else if (decimals > COMMON_DECIMALS) {
    notes.decimals = DECIMALS_NOTE;
  }

  const duplicateSymbol =
    chainId !== null && !problem && symbolOk
      ? duplicateSymbolWarning(chainId, draft.address, draft.symbol)
      : null;

  const token =
    Object.keys(errors).length === 0 && chainId !== null && decimals !== null
      ? {
          chainId,
          address: draft.address.toLowerCase(),
          symbol: draft.symbol,
          decimals,
        }
      : null;

  return { token, errors, notes, duplicateSymbol, existing };
}
