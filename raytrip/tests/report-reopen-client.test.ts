import { afterEach, expect, it, vi } from 'vitest';
import { RayfinServerClient } from '@microsoft/rayfin-client';
import type { TripReportRecord } from '../rayfin/data/TripReport';

afterEach(() => vi.unstubAllGlobals());

it('serializes an explicit null finalization timestamp through the installed SDK', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({
    data: { updateTripReport: { id: 'report-1', status: 'draft', finalizedAt: null } },
  }), { headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetch);
  const client = new RayfinServerClient<{ TripReport: TripReportRecord }>({
    baseUrl: 'https://rayfin.example.test',
    publishableKey: 'pk-test',
  });

  const result = await client.data.TripReport.update(
    { id: 'report-1' }, { status: 'draft', finalizedAt: null }
  );

  expect(fetch).toHaveBeenCalledOnce();
  const body = fetch.mock.calls[0][1]?.body;
  if (typeof body !== 'string') throw new Error('Expected an encoded GraphQL request.');
  const request = JSON.parse(body);
  expect(request.query).toMatch(/finalizedAt:\s*null/);
  expect(request.query).toMatch(/status:\s*"draft"/);
  expect(result.finalizedAt).toBeNull();
});
