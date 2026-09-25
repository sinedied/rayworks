import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ register: vi.fn() }));
vi.mock('../rayfin/functions/node_modules/@microsoft/fabric-user-data-functions/dist/index.js', () => ({
  AudienceType: { AzureAI: 'AzureAI' },
  UserDataFunctions: class {
    func = mocks.register;
    connection(value: unknown) { return value; }
  },
}));
await import('../rayfin/functions/src/function_app');
const generate = mocks.register.mock.calls.find(call => call[0] === 'generateTripReport')![1];

function context(status = 'draft') {
  const readReport = vi.fn().mockResolvedValue([{ id: 'r1', shareId: 's1', status }]);
  const update = vi.fn();
  const create = vi.fn();
  const page = { items: [], hasNextPage: false };
  const query = (execute: ReturnType<typeof vi.fn>, executePaginated = vi.fn().mockResolvedValue(page)) => {
    const builder = {
      where: vi.fn(() => builder), orderBy: vi.fn(() => builder),
      first: vi.fn(() => builder), after: vi.fn(() => builder), execute, executePaginated,
    };
    return { select: vi.fn(() => builder), builder };
  };
  const notes = query(vi.fn());
  const data = {
    Trip: query(vi.fn().mockResolvedValue([{ id: 't1', title: 'Trip', owner_id: 'owner' }])),
    TripReport: { ...query(readReport), update, create },
    TripDay: notes,
    TripPhoto: query(vi.fn()),
  };
  const ctx = {
    getSecret: (name: string) => name === 'AZURE_FOUNDRY_ENDPOINT' ? 'https://foundry.example/openai/v1/' : 'model',
    getDataClient: () => data,
    getToken: () => 'test-token',
  };
  return { ctx, update, create, readReport, notes };
}

beforeEach(() => { vi.unstubAllGlobals(); });
describe('generateTripReport persistence', () => {
  it('does not call the model for finalized reports', async () => {
    const state = context('finalized');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(generate('t1', state.ctx)).rejects.toThrow('finalized');
    expect(fetch).not.toHaveBeenCalled();
    expect(state.update).not.toHaveBeenCalled();
  });
  it('keeps the previous report after invalid model output', async () => {
    const state = context();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: 'length', message: { content: 'Incomplete' } }],
    }))));
    await expect(generate('t1', state.ctx)).rejects.toThrow('incomplete');
    expect(state.update).not.toHaveBeenCalled();
    expect(state.create).not.toHaveBeenCalled();
  });
  it('pages through notes and persists only the single field, retaining the share link', async () => {
    const state = context();
    state.notes.builder.executePaginated
      .mockResolvedValueOnce({ items: [{ day: '2026-09-25', notes: 'Page one' }], hasNextPage: true, endCursor: 'next' })
      .mockResolvedValueOnce({ items: [{ day: '2026-09-26', notes: 'Page two' }], hasNextPage: false });
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: 'stop', message: { content: '## Summary\nComplete' } }],
    })));
    vi.stubGlobal('fetch', fetch);
    await expect(generate('t1', state.ctx)).resolves.toEqual({ reportId: 'r1', shareId: 's1', content: '## Summary\nComplete' });
    expect(state.notes.builder.after).toHaveBeenCalledWith('next');
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.messages[1].content).toContain('Page two');
    expect(body).not.toHaveProperty('temperature');
    expect(state.update).toHaveBeenCalledWith({ id: 'r1' }, {
      title: 'Trip', content: '## Summary\nComplete', generatedAt: expect.any(Date), status: 'draft',
    });
  });
  it('rechecks finalization after inference before updating', async () => {
    const state = context();
    state.readReport.mockResolvedValueOnce([{ id: 'r1', shareId: 's1', status: 'draft' }])
      .mockResolvedValueOnce([{ id: 'r1', shareId: 's1', status: 'finalized' }]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: 'stop', message: { content: 'Valid' } }],
    }))));
    await expect(generate('t1', state.ctx)).rejects.toThrow('finalized');
    expect(state.update).not.toHaveBeenCalled();
  });
});
