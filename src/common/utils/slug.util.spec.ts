import { slugify, uniqueSlug } from './slug.util';

describe('slugify', () => {
  it('lowercases and hyphenates words', () => {
    expect(slugify('Oxford Shirt')).toBe('oxford-shirt');
  });

  it('replaces special characters and collapses hyphens', () => {
    expect(slugify("Men's  Shirts!!")).toBe('men-s-shirts');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugify('  --Hello--World--  ')).toBe('hello-world');
  });
});

describe('uniqueSlug', () => {
  it('returns the base slug when free', async () => {
    await expect(
      uniqueSlug('Shoe', () => Promise.resolve(false)),
    ).resolves.toBe('shoe');
  });

  it('suffixes -2, -3 … on collision', async () => {
    const taken = new Set(['shoe', 'shoe-2']);
    await expect(
      uniqueSlug('Shoe', (candidate) => Promise.resolve(taken.has(candidate))),
    ).resolves.toBe('shoe-3');
  });
});
