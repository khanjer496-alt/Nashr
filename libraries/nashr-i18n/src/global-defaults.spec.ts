import { DEFAULT_CURRENCY, currencyForMarket, formatCurrency } from './currency';
import { DEFAULT_MARKET, getMarket, marketFromLocale } from './markets';
import { DEFAULT_TIMEZONE, timezoneForLocale } from './timezone';

describe('global defaults with regional overlays', () => {
  it('uses a neutral global market when no market is known', () => {
    expect(DEFAULT_MARKET).toBe('GLOBAL');
    expect(getMarket()).toMatchObject({
      code: 'GLOBAL',
      timezone: 'UTC',
      currency: 'USD',
      localeEn: 'en',
      localeAr: 'ar',
    });
  });

  it('uses UTC and USD as product defaults', () => {
    expect(DEFAULT_TIMEZONE).toBe('UTC');
    expect(DEFAULT_CURRENCY).toBe('USD');
    expect(timezoneForLocale('ar')).toBe('UTC');
    expect(currencyForMarket()).toBe('USD');
    expect(formatCurrency(12)).toMatch(/\$|USD/);
  });

  it('preserves explicit regional behavior', () => {
    expect(marketFromLocale('ar-AE')?.code).toBe('AE');
    expect(timezoneForLocale('ar-AE')).toBe('Asia/Dubai');
    expect(currencyForMarket('AE')).toBe('AED');
    expect(currencyForMarket('SA')).toBe('SAR');
  });
});
