import { brand } from './brand.config';

describe('global product positioning', () => {
  it('positions the product for humans and AI agents', () => {
    expect(brand.tagline).toBe(
      'Social publishing infrastructure for humans and AI agents'
    );
    expect(brand.description).toBe(
      'Plan, approve, automate and publish social content across every channel from one workspace.'
    );
  });

  it('uses neutral defaults while preserving Arabic localization', () => {
    expect(brand.defaultLocale).toBe('en');
    expect(brand.defaultTimezone).toBe('UTC');
    expect(brand.locales).toEqual(expect.arrayContaining(['en', 'ar']));
    expect(brand.taglineAr).toContain('وكلاء الذكاء الاصطناعي');
  });

  it('does not make a region the primary product identity', () => {
    const primaryCopy = `${brand.tagline} ${brand.description}`;
    expect(primaryCopy).not.toMatch(/Middle East|MENA|Gulf time/i);
  });

  it('retains the temporary name and Postiz attribution', () => {
    expect(brand.name).toBe('Nashr');
    expect(brand.upstream.name).toBe('Postiz');
    expect(brand.upstream.license).toBe('AGPL-3.0');
  });
});
