import {
  Generation,
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
