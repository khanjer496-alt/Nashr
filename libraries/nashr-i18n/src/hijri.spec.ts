/**
 * Ramadan and Eid dates are the highest-visibility thing this product prints.
 * A wrong date is immediately obvious to every customer in-market, so the
 * conversion is pinned against real observed dates rather than trusted.
 */
import {
  toHijri,
  fromHijri,
  RAMADAN,
  SHAWWAL,
  DHU_AL_HIJJAH,
} from './hijri';

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

describe('hijri ↔ gregorian conversion', () => {
  // Umm al-Qura calendar dates. Actual observance can shift by a day on local
  // moon sighting, which is why campaign scheduling must allow a ±1 day window.
  it.each([
    ['Ramadan 1, 1445', 1445, RAMADAN, 1, '2024-03-11'],
    ['Eid al-Fitr, 1446', 1446, SHAWWAL, 1, '2025-03-30'],
    ['Eid al-Adha, 1447', 1447, DHU_AL_HIJJAH, 10, '2026-05-27'],
  ])('%s = %s', (_label, y, m, d, expected) => {
    expect(iso(fromHijri(y as number, m as number, d as number))).toBe(expected);
  });

  it('round-trips 400 consecutive Gregorian days with no drift', () => {
    const failures: string[] = [];
    for (let i = 0; i < 400; i++) {
      const day = new Date(Date.UTC(2024, 0, 1 + i));
      const h = toHijri(day);
      const back = fromHijri(h.year, h.month, h.day);
      if (iso(back) !== iso(day)) failures.push(`${iso(day)} -> ${iso(back)}`);
    }
    expect(failures).toEqual([]);
  });

  it('returns null for a date that does not exist in the calendar', () => {
    expect(fromHijri(1446, 13, 1)).toBeNull();
  });
});
