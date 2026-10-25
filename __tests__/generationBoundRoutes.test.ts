import {
  cardHasRoute,
  cardPredatesRoute,
  everyCardInUseHasRoute,
  isRouteHidden,
  routeAbsence,
} from '../src/navigation/generationBoundRoutes';
import { ALL_GENERATIONS } from '../src/utils/cardGeneration';

// Routes 4.0 took away. BIP85, which 4.0 added, has its own block below.
const ROUTES = ['PairingSlots', 'ChangePairingSecret'] as const;
const ALL_ROUTES = [...ROUTES, 'Bip85'] as const;

// What the user said about their cards. Only ever decides what a menu draws.
describe('isRouteHidden', () => {
  // Pairing went away with applet 4.0.
  it.each(ROUTES)('hides %s when only 4.x cards are ticked', route => {
    expect(isRouteHidden(route, ['4.0'])).toBe(true);
  });

  it.each(ROUTES)('shows %s as long as one ticked card has it', route => {
    expect(isRouteHidden(route, ['3.1'])).toBe(false);
    expect(isRouteHidden(route, ['3.1', '4.0'])).toBe(false);
  });

  // An empty selection hides nothing.
  it.each(ROUTES)('shows %s for an empty selection', route => {
    expect(isRouteHidden(route, [])).toBe(false);
  });
});

// Also a preference: decides whether the tap that reads the card is needed.
describe('everyCardInUseHasRoute', () => {
  it.each(ROUTES)('is true for %s when only 3.x cards are ticked', route => {
    expect(everyCardInUseHasRoute(route, ['3.1'])).toBe(true);
  });

  it.each(ROUTES)('is false for %s once a 4.x card is ticked', route => {
    expect(everyCardInUseHasRoute(route, ['3.1', '4.0'])).toBe(false);
    expect(everyCardInUseHasRoute(route, ['4.0'])).toBe(false);
  });

  // Nothing ticked proves nothing, so the card is read first.
  it.each(ROUTES)('is false for %s on an empty selection', route => {
    expect(everyCardInUseHasRoute(route, [])).toBe(false);
  });
});

// What the card on the antenna actually has. This one does refuse.
describe('cardHasRoute', () => {
  it.each(ROUTES)('is true for %s on a 3.1 card', route => {
    expect(cardHasRoute(route, '3.1')).toBe(true);
  });

  it.each(ROUTES)('is false for %s on a 4.0 card', route => {
    expect(cardHasRoute(route, '4.0')).toBe(false);
  });

  // Null is a card below the floor: never a yes.
  it.each(ALL_ROUTES)('is false for %s when the card is unknown', route => {
    expect(cardHasRoute(route, null)).toBe(false);
  });
});

// The first destination a generation added rather than took away.
describe('Bip85', () => {
  it('is hidden when only 3.x cards are ticked', () => {
    expect(isRouteHidden('Bip85', ['3.1'])).toBe(true);
  });

  it('shows as long as a 4.x card is ticked', () => {
    expect(isRouteHidden('Bip85', ['4.0'])).toBe(false);
    expect(isRouteHidden('Bip85', ['3.1', '4.0'])).toBe(false);
    expect(isRouteHidden('Bip85', [])).toBe(false);
  });

  it('is on every card in use only when only 4.x cards are ticked', () => {
    expect(everyCardInUseHasRoute('Bip85', ['4.0'])).toBe(true);
    expect(everyCardInUseHasRoute('Bip85', ['3.1', '4.0'])).toBe(false);
    expect(everyCardInUseHasRoute('Bip85', ['3.1'])).toBe(false);
  });

  it('is on a 4.0 card and not on a 3.1 card', () => {
    expect(cardHasRoute('Bip85', '4.0')).toBe(true);
    expect(cardHasRoute('Bip85', '3.1')).toBe(false);
  });
});

// Decides whether the refused card's PIN is kept: only a card too old is swapped for another.
describe('cardPredatesRoute', () => {
  it('is true for a 3.1 card asked for Bip85', () => {
    expect(cardPredatesRoute('Bip85', '3.1')).toBe(true);
  });

  it('is false for a card that has the route', () => {
    expect(cardPredatesRoute('Bip85', '4.0')).toBe(false);
  });

  it.each(ROUTES)('is false for a 4.0 card refused %s', route => {
    expect(cardPredatesRoute(route, '4.0')).toBe(false);
  });

  it('is false when the card is unknown', () => {
    expect(cardPredatesRoute('Bip85', null)).toBe(false);
  });
});

describe('routeAbsence', () => {
  it.each(ALL_ROUTES)('has every piece of copy for %s', route => {
    const absence = routeAbsence(route);
    expect(absence.title.length).toBeGreaterThan(0);
    expect(absence.detail.length).toBeGreaterThan(0);
    expect(absence.sheetError.length).toBeGreaterThan(0);
  });

  // A PIN was typed by then, so the copy says nothing was changed.
  it.each(ALL_ROUTES)(
    'says nothing happened in the sheet error for %s',
    route => {
      expect(routeAbsence(route).sheetError).toMatch(/nothing was/);
    },
  );

  // A generation's label ("applet 4.x") is how the UI names it (ADR-0012); nothing else is.
  it.each(ALL_ROUTES)('keeps internal vocabulary out of %s', route => {
    const copy = Object.values(routeAbsence(route))
      .join(' ')
      .replace(/applet \d+\.x/gi, '');
    expect(copy).not.toMatch(/generation|secure channel|applet/i);
  });

  it('names the first generation that has Bip85 by its label', () => {
    expect(routeAbsence('Bip85').detail).toBe(
      'This needs a Keycard with applet 4.x.',
    );
  });
});

// A span whose first generation is newer than its last would hide the entry and refuse every card.
describe('route table', () => {
  it.each(ALL_ROUTES)('gives %s to at least one generation', route => {
    expect(ALL_GENERATIONS.some(g => cardHasRoute(route, g))).toBe(true);
  });
});
