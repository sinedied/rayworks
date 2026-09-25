import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const config = readFileSync(new URL('../rayfin/rayfin.yml', import.meta.url), 'utf8');

describe('RayDeck private deployment configuration', () => {
  it('requires Fabric auth and protected static hosting', () => {
    expect(config).toMatch(/auth:\s*\n\s+enabled: true/);
    expect(config).toMatch(/fabric:\s*\n\s+enabled: true/);
    expect(config).toMatch(/password:\s*\n\s+enabled: false/);
    expect(config).toMatch(/staticHosting:\s*\n\s+enabled: true\s*\n\s+assetAccess: protected/);
  });

  it('keeps only the intended redirect origins', () => {
    const redirects = config.match(/allowedRedirectUris:\s*\n((?:\s+- .+\n)+)/)?.[1]
      .trim().split('\n').map((line) => line.replace(/^\s*-\s*/, ''));
    expect(redirects).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://fond-moor-c78aa9941b-swedencentral.webapp.fabricapps.net',
    ]);
  });
});
