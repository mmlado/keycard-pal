import { isRouteHidden } from '../src/navigation/generationBoundRoutes';

describe('isRouteHidden', () => {
  // Pairing went away with applet 4.0, so both pairing destinations are the
  // ones a user with only newer cards never needs to see.
  it.each(['PairingSlots', 'ChangePairingSecret'] as const)(
    'hides %s once the user has declared 4.0 cards',
    route => {
      expect(isRouteHidden(route, '4.0')).toBe(true);
    },
  );

  it.each(['PairingSlots', 'ChangePairingSecret'] as const)(
    'shows %s for 3.1 cards and when nothing is declared',
    route => {
      expect(isRouteHidden(route, '3.1')).toBe(false);
      expect(isRouteHidden(route, 'any')).toBe(false);
    },
  );
});
