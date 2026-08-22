import fs from 'node:fs';
import path from 'node:path';
import { brand } from './brand.config';

const root = path.resolve(__dirname, '../../..');
const publicDirectory = path.join(root, 'apps/frontend/public');

const configuredSvgAssets = [
  brand.logo.mark,
  brand.logo.wordmark,
  brand.logo.wordmarkAr,
  brand.logo.favicon,
  brand.logo.ogImage,
];

describe('Orbiloom brand assets', () => {
  it.each(configuredSvgAssets)('%s is a safe, scalable SVG', (asset) => {
    const file = path.join(publicDirectory, asset.replace(/^\//, ''));
    expect(fs.existsSync(file)).toBe(true);

    const svg = fs.readFileSync(file, 'utf8');
    expect(svg).toContain('<svg');
    expect(svg).toMatch(/viewBox="[^"]+"/);
    expect(svg).not.toMatch(/<script|data:image\//i);
  });

  it('uses the approved orbital palette in the primary mark', () => {
    const mark = fs.readFileSync(
      path.join(publicDirectory, brand.logo.mark.replace(/^\//, '')),
      'utf8'
    );

    expect(mark).toContain('#7357FF');
    expect(mark).toContain('#C8FF4D');
    expect(mark).toContain('#F7F7F2');
    expect(mark).not.toMatch(/#0E7C74|#14A79B/i);
  });

  it('keeps the React mark accessible and collision-safe', () => {
    const component = fs.readFileSync(
      path.join(
        root,
        'apps/frontend/src/components/ui/brand.mark.tsx'
      ),
      'utf8'
    );

    expect(component).toContain('useId');
    expect(component).toContain('brand.name');
    expect(component).not.toMatch(/aria-label="Nashr"/);
  });

  it('keeps application CSS synchronized with the approved tokens', () => {
    const colors = fs.readFileSync(
      path.join(root, 'apps/frontend/src/app/colors.scss'),
      'utf8'
    );

    for (const value of [
      '#080A0F',
      '#11141C',
      '#F7F7F2',
      '#9299AA',
      '#7357FF',
      '#6043F2',
      '#C8FF4D',
      '#FF5F74',
      '#2A2F3B',
    ]) {
      expect(colors.toUpperCase()).toContain(value.toUpperCase());
    }

    expect(colors).toContain('Orbiloom brand design tokens');
    expect(colors).not.toMatch(/--brand-primary:\s*#0E7C74/i);
  });
});
