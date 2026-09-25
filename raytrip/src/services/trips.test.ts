import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientMocks = vi.hoisted(() => {
  const execute = vi.fn();
  const first = vi.fn(() => ({ execute }));
  const where = vi.fn(() => ({ first }));
  const select = vi.fn(() => ({ where }));
  const findById = vi.fn();
  const createTripDay = vi.fn();
  const updateReport = vi.fn();

  return { execute, first, where, select, findById, createTripDay, updateReport };
});

vi.mock('./rayfinClient', () => ({
  getRayfinClient: () => ({
    data: {
      Trip: {
        select: clientMocks.select,
        findById: clientMocks.findById,
      },
      TripDay: {
        create: clientMocks.createTripDay,
      },
      TripReport: { update: clientMocks.updateReport },
    },
  }),
}));

import { finalizeTripReport, getTrip, saveTripDay, saveTripReport } from './trips';

describe('single report mutations', () => {
  beforeEach(() => vi.clearAllMocks());
  it('saves only the new field and finalizes the same text atomically', async () => {
    await saveTripReport('r1', '  ## Summary\nSaved  ');
    expect(clientMocks.updateReport).toHaveBeenCalledWith({ id: 'r1' }, { content: '## Summary\nSaved' });
    await finalizeTripReport('r1', '## Summary\nFinal');
    expect(clientMocks.updateReport).toHaveBeenLastCalledWith({ id: 'r1' }, {
      content: '## Summary\nFinal', status: 'finalized', finalizedAt: expect.any(Date),
    });
  });
  it('does not persist empty or over-limit content', async () => {
    await expect(saveTripReport('r1', '')).rejects.toThrow();
    await expect(finalizeTripReport('r1', 'x'.repeat(2501))).rejects.toThrow();
    expect(clientMocks.updateReport).not.toHaveBeenCalled();
  });
});

describe('getTrip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveTripDay', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('sends the explicit foreign key without a duplicate relationship field', async () => {
      clientMocks.createTripDay.mockResolvedValue({});

      await saveTripDay(
        'trip-1',
        'user-1',
        {
          day: new Date('2026-09-18'),
          title: 'Conference day',
          notes: 'Met the product team.',
        }
      );

      expect(clientMocks.createTripDay).toHaveBeenCalledOnce();
      const input = clientMocks.createTripDay.mock.calls[0][0];
      expect(input.trip_id).toBe('trip-1');
      expect(input).not.toHaveProperty('trip');
    });
  });

  it('queries every field required by the trip route', async () => {
    const trip = {
      id: 'trip-1',
      title: 'Build conference',
      destination: 'Seattle',
      purpose: 'Customer research',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-03'),
      status: 'draft',
      createdAt: new Date('2026-08-20'),
      updatedAt: new Date('2026-08-20'),
      owner_id: 'user-1',
    };
    clientMocks.execute.mockResolvedValue([trip]);

    await expect(getTrip('trip-1')).resolves.toEqual(trip);
    expect(clientMocks.select).toHaveBeenCalledWith([
      'id',
      'title',
      'destination',
      'purpose',
      'startDate',
      'endDate',
      'status',
      'createdAt',
      'updatedAt',
      'owner_id',
    ]);
    expect(clientMocks.where).toHaveBeenCalledWith({
      id: { eq: 'trip-1' },
    });
    expect(clientMocks.first).toHaveBeenCalledWith(1);
    expect(clientMocks.findById).not.toHaveBeenCalled();
  });

  it('returns null when the trip query has no result', async () => {
    clientMocks.execute.mockResolvedValue([]);

    await expect(getTrip('missing')).resolves.toBeNull();
  });
});
