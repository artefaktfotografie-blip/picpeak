// artefakt fork: validation of pen-annotation payloads.
jest.mock('../../database/db', () => ({ db: jest.fn() }));
const { sanitizeStrokes, sanitizeNote } = require('../annotationService');

describe('annotationService.sanitizeStrokes', () => {
  const stroke = (overrides = {}) => ({
    color: '#e8493f',
    width: 0.006,
    points: [[0.1, 0.2], [0.3, 0.4]],
    ...overrides,
  });

  it('accepts red and white strokes and rounds coordinates', () => {
    const { strokes, error } = sanitizeStrokes([
      stroke({ points: [[0.123456789, 0.5]] }),
      stroke({ color: '#FFFFFF' }),
    ]);
    expect(error).toBeUndefined();
    expect(strokes[0].points[0]).toEqual([0.1235, 0.5]);
    expect(strokes[1].color).toBe('#ffffff');
  });

  it('accepts an empty drawing (used to clear)', () => {
    expect(sanitizeStrokes([])).toEqual({ strokes: [] });
  });

  it.each([
    ['not an array', 'nope'],
    ['unknown colour', [stroke({ color: '#00ff00' })]],
    ['point out of range', [stroke({ points: [[1.2, 0.5]] })]],
    ['non-numeric point', [stroke({ points: [['a', 0.5]] })]],
    ['zero width', [stroke({ width: 0 })]],
    ['huge width', [stroke({ width: 0.5 })]],
    ['empty stroke', [stroke({ points: [] })]],
    ['too many strokes', Array.from({ length: 201 }, () => stroke())],
  ])('rejects %s', (_label, input) => {
    expect(sanitizeStrokes(input).error).toBeTruthy();
  });

  it('rejects drawings over the total point budget', () => {
    const big = Array.from({ length: 25 }, () =>
      stroke({ points: Array.from({ length: 1900 }, (_, i) => [i / 1900, 0.5]) })
    );
    expect(sanitizeStrokes(big).error).toBe('Drawing too large');
  });
});

describe('annotationService.sanitizeNote', () => {
  it('trims, strips angle brackets and caps the length', () => {
    expect(sanitizeNote('  <b>hier</b> retuschieren ')).toBe('bhier/b retuschieren');
    expect(sanitizeNote('x'.repeat(2000))).toHaveLength(1000);
  });

  it('turns empty input into null', () => {
    expect(sanitizeNote('   ')).toBeNull();
    expect(sanitizeNote(undefined)).toBeNull();
  });
});
