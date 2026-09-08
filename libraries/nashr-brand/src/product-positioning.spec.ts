import { brand } from './brand.config';

describe('global product positioning', () => {
  it('positions the product for humans and AI agents', () => {
    expect(brand.name).toBe('PostDelegate');
    expect(brand.nameAr).toBe('بوست ديليجيت');
    expect(brand.nameLower).toBe('postdelegate');
    expect(brand.tagline).toBe(
      'Social publishing infrastructure for humans and AI agents'
    );
    expect(brand.heroLine).toBe('Put every channel in motion.');
    expect(brand.campaignLine).toBe('Delegate the work. Keep control.');
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

  it('uses the approved visual identity and retains Postiz attribution', () => {
    expect(brand.colors).toMatchObject({
      primary: '#7357FF',
      primaryHover: '#6043F2',
      primarySoft: '#8D78FF',
      accent: '#C8FF4D',
      accentHover: '#B4EA35',
      gold: '#FF5F74',
      ink: '#080A0F',
      surface: '#11141C',
      surfaceRaised: '#191D27',
      border: '#2A2F3B',
      textPrimary: '#F7F7F2',
      textMuted: '#9299AA',
    });
    expect(brand.logo).toMatchObject({
      mark: '/postdelegate-mark.svg',
      wordmark: '/postdelegate-logo.svg',
      wordmarkAr: '/postdelegate-logo-ar.svg',
      favicon: '/favicon.svg',
    });
    expect(brand.upstream.name).toBe('Postiz');
    expect(brand.upstream.license).toBe('AGPL-3.0');
  });
});
