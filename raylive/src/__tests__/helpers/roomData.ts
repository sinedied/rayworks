import type { RayLiveSchema } from '../../../rayfin/data/schema';

type TableName = keyof RayLiveSchema;
type Operation = 'read' | 'create' | 'update' | 'delete';

export const backend = {
  userId: 'owner-1' as string | null,
  failure: null as { table: TableName; operation: Operation; remaining: number } | null,
  before: null as ((table: TableName, operation: Operation) => void) | null,
  writes: [] as { table: TableName; operation: Operation; id: string }[],
};

function operation(table: TableName, op: Operation, id?: string) {
  backend.before?.(table, op);
  const failure = backend.failure;
  if (failure?.table === table && failure.operation === op && --failure.remaining === 0) {
    backend.failure = null;
    throw new Error(`Failed ${table}.${op}`);
  }
  if (id) backend.writes.push({ table, operation: op, id });
}

function table<T extends { id: string }>(name: TableName) {
  const rows = new Map<string, T>();
  return {
    rows,
    select: (_fields: string[]) => {
      let filters: Record<string, { eq: unknown }> = {};
      let order: Record<string, 'asc' | 'desc'> = {};
      let limit = 100;
      let offset = 0;
      const matches = () => {
        operation(name, 'read');
        return [...rows.values()]
          .filter((row) => Object.entries(filters).every(([key, filter]) => Reflect.get(row, key) === filter.eq))
          .sort((a, b) => {
            for (const [key, direction] of Object.entries(order)) {
              const left = Reflect.get(a, key);
              const right = Reflect.get(b, key);
              if (left !== right) return (left < right ? -1 : 1) * (direction === 'asc' ? 1 : -1);
            }
            return 0;
          });
      };
      const query = {
        where: (value: typeof filters) => { filters = value; return query; },
        orderBy: (value: typeof order) => { order = value; return query; },
        first: (value: number) => { limit = value; return query; },
        after: (value: string) => { offset = Number(value); return query; },
        execute: async () => structuredClone(matches().slice(offset, offset + limit)),
        executePaginated: async () => {
          const all = matches();
          return {
            items: structuredClone(all.slice(offset, offset + limit)),
            hasNextPage: offset + limit < all.length,
            endCursor: String(offset + limit),
          };
        },
      };
      return query;
    },
    create: async (row: T) => {
      operation(name, 'create', row.id);
      if (rows.has(row.id)) throw new Error('Duplicate ID');
      rows.set(row.id, structuredClone(row));
      return structuredClone(row);
    },
    update: async ({ id }: { id: string }, updates: Partial<T>) => {
      operation(name, 'update', id);
      const row = rows.get(id);
      if (!row) throw new Error('Row not found');
      const updated = { ...row, ...structuredClone(updates) };
      rows.set(id, updated);
      return updated;
    },
    delete: async ({ id }: { id: string }) => {
      operation(name, 'delete', id);
      if (!rows.delete(id)) throw new Error('Row not found');
    },
  };
}

export const data = {
  Room: table<RayLiveSchema['Room']>('Room'),
  Activity: table<RayLiveSchema['Activity']>('Activity'),
  ActivityOption: table<RayLiveSchema['ActivityOption']>('ActivityOption'),
  Answer: table<RayLiveSchema['Answer']>('Answer'),
  Question: table<RayLiveSchema['Question']>('Question'),
  Vote: table<RayLiveSchema['Vote']>('Vote'),
};

export const client = {
  data,
  auth: {
    getSession: () => ({
      isAuthenticated: backend.userId !== null,
      user: backend.userId ? { id: backend.userId } : undefined,
    }),
  },
};

export const room: RayLiveSchema['Room'] = {
  id: 'room-1', owner_id: 'owner-1', code: 'test', title: 'Rehearsal',
  isOpen: true, isAcceptingQuestions: true, qnaEnabled: true, createdAt: new Date(),
};
export const activity: RayLiveSchema['Activity'] = {
  id: 'activity-1', room_id: room.id, owner_id: room.owner_id,
  kind: 'quiz', prompt: 'Question?', state: 'ended', position: 0,
  showResults: true, allowMultiple: false, createdAt: new Date(),
  isPrepared: false, startedAt: new Date(), timeLimitSeconds: 20,
};
export const option: RayLiveSchema['ActivityOption'] = {
  id: 'option-1', activity_id: activity.id, room_id: room.id, owner_id: room.owner_id,
  label: 'One', position: 0, isCorrect: true, revealedCorrect: true,
};
export const answer: RayLiveSchema['Answer'] = {
  id: 'answer-1', activity_id: activity.id, room_id: room.id, owner_id: room.owner_id,
  participantKey: 'participant-1', option_id: option.id, isHidden: true, createdAt: new Date(),
};
export const question: RayLiveSchema['Question'] = {
  id: 'question-1', room_id: room.id, owner_id: room.owner_id,
  content: 'Audience question', isHidden: true, isAnswered: true, createdAt: new Date(),
};
export const vote: RayLiveSchema['Vote'] = {
  id: 'vote-1', question_id: question.id, room_id: room.id, owner_id: room.owner_id,
  voterKey: 'participant-1', createdAt: new Date(),
};

export function seed() {
  backend.failure = null;
  backend.before = null;
  backend.writes = [];
  backend.userId = room.owner_id;
  for (const table of Object.values(data)) table.rows.clear();
  data.Room.rows.set(room.id, { ...room });
  data.Activity.rows.set(activity.id, { ...activity });
  data.ActivityOption.rows.set(option.id, { ...option });
  data.ActivityOption.rows.set('option-2', { ...option, id: 'option-2', label: 'Two', position: 1, isCorrect: false });
  data.Question.rows.set(question.id, { ...question });
  data.Vote.rows.set(vote.id, { ...vote });
  data.Answer.rows.set(answer.id, { ...answer });
}
