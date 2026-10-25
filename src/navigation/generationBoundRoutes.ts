import {
  Generation,
  generationLabel,
  isNewerGeneration,
} from '@/utils/cardGeneration';

/** Destinations only some cards have. `ChangeSecret` is bound for the pairing secret only. */
export type GenerationBoundRoute =
  | 'PairingSlots'
  | 'ChangePairingSecret'
  | 'Bip85';

/** The first and last generation that have a destination; at least one is set. */
type GenerationSpan =
  | { first: Generation; last?: Generation }
  | { first?: Generation; last: Generation };

/**
 * The generations that have each destination; the whole list lives here. `isRouteHidden` and
 * `everyCardInUseHasRoute` answer the user's preference, `cardHasRoute` answers the tapped card.
 * Only the last one refuses anything.
 */
const ROUTE_GENERATIONS = {
  PairingSlots: { last: '3.1' },
  ChangePairingSecret: { last: '3.1' },
  Bip85: { first: '4.0' },
} as const satisfies Record<GenerationBoundRoute, GenerationSpan>;

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
  const { last }: GenerationSpan = ROUTE_GENERATIONS[route];
  return (
    !cardPredatesRoute(route, generation) &&
    !(last && isNewerGeneration(generation, last))
  );
}

/** The card is older than the destination, so the user is sent to another card. */
export function cardPredatesRoute(
  route: GenerationBoundRoute,
  generation: Generation | null,
): boolean {
  const { first }: GenerationSpan = ROUTE_GENERATIONS[route];
  return (
    generation !== null &&
    first !== undefined &&
    isNewerGeneration(first, generation)
  );
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
  Bip85: {
    title: 'No BIP85 on this Keycard',
    // Shown on the index screen while an older card is ticked.
    detail: `This needs a Keycard with applet ${generationLabel(
      ROUTE_GENERATIONS.Bip85.first,
    )}.`,
    sheetError:
      'This Keycard cannot derive BIP85 secrets, so nothing was derived. Tap ' +
      'a newer Keycard.',
  },
};

export function routeAbsence(route: GenerationBoundRoute): RouteAbsence {
  return NOT_ON_CARD[route];
}
