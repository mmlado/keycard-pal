import { Generation, isNewerGeneration } from '@/utils/cardGeneration';

/** Destinations newer cards no longer have. `ChangeSecret` is bound for the pairing secret only. */
export type GenerationBoundRoute = 'PairingSlots' | 'ChangePairingSecret';

/**
 * The last generation that has each destination; the whole list lives here. `isRouteHidden` and
 * `everyCardInUseHasRoute` answer the user's preference, `cardHasRoute` answers the tapped card.
 * Only the last one refuses anything.
 */
const LAST_GENERATION: Record<GenerationBoundRoute, Generation> = {
  PairingSlots: '3.1',
  ChangePairingSecret: '3.1',
};

/** No ticked generation has it: leave the menu entry out. An empty selection hides nothing. */
export function isRouteHidden(
  route: GenerationBoundRoute,
  generationsInUse: readonly Generation[],
): boolean {
  return (
    generationsInUse.length > 0 &&
    !generationsInUse.some(generation => cardHasRoute(route, generation))
  );
}

/** Every ticked generation has it: the identify tap can be skipped. An empty selection keeps it. */
export function everyCardInUseHasRoute(
  route: GenerationBoundRoute,
  generationsInUse: readonly Generation[],
): boolean {
  return (
    generationsInUse.length > 0 &&
    generationsInUse.every(generation => cardHasRoute(route, generation))
  );
}

/** Null is a card below the floor, which the session has already refused. */
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
  /** Shown when the tap landed on a card without it. Says nothing was changed: a PIN was typed. */
  sheetError: string;
}

/** Keyed by route, so a new bound route does not compile without copy. */
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
