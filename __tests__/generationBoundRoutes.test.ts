import {
  cardHasRoute,
  isRouteHidden,
  routeAbsence,
} from '../src/navigation/generationBoundRoutes';

const ROUTES = ['PairingSlots', 'ChangePairingSecret'] as const;

// What the user said about their cards. Only ever decides what a menu draws.
describe('isRouteHidden', () => {
  // Pairing went away with applet 4.0, so both pairing destinations are the
  // ones a user with only newer cards never needs to see.
  it.each(ROUTES)('hides %s once the user has declared 4.0 cards', route => {
    expect(isRouteHidden(route, '4.0')).toBe(true);
  });

  it.each(ROUTES)(
    'shows %s for 3.1 cards and when nothing is declared',
    route => {
      expect(isRouteHidden(route, '3.1')).toBe(false);
      expect(isRouteHidden(route, 'any')).toBe(false);
    },
  );
});

// What the card on the antenna actually has. This one does refuse.
describe('cardHasRoute', () => {
  it.each(ROUTES)('is true for %s on a 3.1 card', route => {
    expect(cardHasRoute(route, '3.1')).toBe(true);
  });

  it.each(ROUTES)('is false for %s on a 4.0 card', route => {
    expect(cardHasRoute(route, '4.0')).toBe(false);
  });

  // Null is a card below the floor. The session refuses those first, so this
  // answer is never reached; it just must not say yes.
  it.each(ROUTES)('is false for %s when the card is unknown', route => {
    expect(cardHasRoute(route, null)).toBe(false);
  });
});

describe('routeAbsence', () => {
  it.each(ROUTES)('has every piece of copy for %s', route => {
    const absence = routeAbsence(route);
    expect(absence.title.length).toBeGreaterThan(0);
    expect(absence.detail.length).toBeGreaterThan(0);
    expect(absence.sheetError.length).toBeGreaterThan(0);
  });

  // The user typed a PIN before this can appear, so it has to say where that
  // left the card.
  it.each(ROUTES)('says nothing happened in the sheet error for %s', route => {
    expect(routeAbsence(route).sheetError).toMatch(/nothing was/);
  });

  it.each(ROUTES)('keeps internal vocabulary out of %s', route => {
    const copy = Object.values(routeAbsence(route)).join(' ');
    expect(copy).not.toMatch(/generation|secure channel|applet/i);
  });
});
