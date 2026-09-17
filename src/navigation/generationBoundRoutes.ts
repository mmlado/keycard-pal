import {
  Generation,
  isNewerGeneration,
  isPastGeneration,
  MinGeneration,
} from '@/utils/cardGeneration';

/**
 * Menu destinations that newer cards no longer have. Each names the route it
 * opens; `ChangeSecret` serves three secrets and only its pairing variant is
 * bound, so that one names the variant.
 */
export type GenerationBoundRoute = 'PairingSlots' | 'ChangePairingSecret';

/**
 * The last generation that still has each bound destination. This table is the
 * whole list on purpose: a menu entry only says which destination it is, so
 * what is bound, and to what, is read in one place.
 *
 * Two questions are asked of it, and they are not the same question.
 * `isRouteHidden` answers a preference: what the user said about their cards.
 * `cardHasRoute` answers the card: what the one on the antenna actually has.
 */
const LAST_GENERATION: Record<GenerationBoundRoute, Generation> = {
  PairingSlots: '3.1',
  ChangePairingSecret: '3.1',
};

/**
 * True when the user has declared cards too new to have this destination. The
 * declaration is a preference, not a fact about the tapped card, so this only
 * decides what a menu shows; the tap still checks the card itself.
 */
export function isRouteHidden(
  route: GenerationBoundRoute,
  minGeneration: MinGeneration,
): boolean {
  return isPastGeneration(minGeneration, LAST_GENERATION[route]);
}

/**
 * True when a card of this generation still has this destination. A null
 * generation is a card below the floor; the session refuses those right after
 * SELECT, so false here is a defensive answer and never a path.
 */
export function cardHasRoute(
  route: GenerationBoundRoute,
  generation: Generation | null,
): boolean {
  if (generation === null) {
    return false;
  }
  return !isNewerGeneration(generation, LAST_GENERATION[route]);
}

/** What the user is told when the tapped card lacks a destination. */
export interface RouteAbsence {
  /** Heading of the screen that explains it. */
  title: string;
  /** Body of that screen. */
  detail: string;
  /**
   * The NFC sheet's error when an operation was already under way and the tap
   * landed on a card without it. It says nothing was changed, because the user
   * typed a PIN and needs to know where that left the card.
   */
  sheetError: string;
}

/**
 * Keyed by route, so a new bound destination does not compile until its copy
 * exists. No applet version is named: the card in hand is what matters here.
 */
const NOT_ON_CARD: Record<GenerationBoundRoute, RouteAbsence> = {
  PairingSlots: {
    title: 'No pairing slots on this Keycard',
    detail:
      'Newer Keycards connect without pairing to a device, so this one has ' +
      'no slots to manage. Nothing is wrong with the card.',
    sheetError:
      'This Keycard has no pairing slots, so nothing was unpaired. Tap the ' +
      'card you started with.',
  },
  ChangePairingSecret: {
    title: 'No pairing secret on this Keycard',
    detail:
      'Newer Keycards connect without a pairing secret, so there is none to ' +
      'change on this one. Its PIN and PUK are unaffected.',
    sheetError:
      'This Keycard has no pairing secret, so nothing was changed. Tap the ' +
      'card you started with.',
  },
};

export function routeAbsence(route: GenerationBoundRoute): RouteAbsence {
  return NOT_ON_CARD[route];
}
