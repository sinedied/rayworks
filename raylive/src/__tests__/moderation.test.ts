import { describe, expect, it } from 'vitest';

import { buildWordCloud, normalizeWordCloudText, tallyAnswers } from '@/lib/aggregate';
import { responseDeletionTargets } from '@/lib/moderation';

function response(id: string, at: number, participantKey = 'one', submissionId?: string) {
  return { id, createdAt: new Date(at), participantKey, submissionId, textValue: id };
}

const single = { kind: 'openText', allowMultiple: false };

describe('responseDeletionTargets', () => {
  it('deletes older replacements first, preserving newer and other participants', () => {
    const rows = [
      response('newer', 300), response('selected', 200),
      response('old', 100), response('other', 100, 'two'),
    ];
    const targets = responseDeletionTargets(single, rows, new Set(['selected']));
    expect(targets.map((row) => row.id)).toEqual(['old', 'selected']);
  });

  it('does not let an older version reappear after deleting a current response', () => {
    const rows = [response('old', 100), response('current', 200)];
    const ids = new Set(responseDeletionTargets(single, rows, new Set(['current'])).map((row) => row.id));
    expect(tallyAnswers(single, rows.filter((row) => !ids.has(row.id)))).toEqual([]);
  });

  it('preserves non-target siblings of a submission even when their row timestamps differ', () => {
    const rows = [
      response('old', 100, 'one', 's1'),
      response('selected', 200, 'one', 's2'),
      response('sibling', 201, 'one', 's2'),
      response('newer', 300, 'one', 's3'),
    ];
    expect(responseDeletionTargets(single, rows, new Set(['selected'])).map((row) => row.id))
      .toEqual(['old', 'selected']);
  });

  it('uses the same timestamp tie precedence as latestSubmissions', () => {
    const rows = [response('current', 100, 'one', 's1'), response('older', 100, 'one', 's2')];
    expect(tallyAnswers(single, rows)).toEqual([rows[0]]);
    expect(responseDeletionTargets(single, rows, new Set(['current'])).map((row) => row.id))
      .toEqual(['older', 'current']);
  });

  it('does not delete legacy same-timestamp siblings or unidentified participants', () => {
    const rows = [
      response('selected', 200), response('sibling', 200), response('old', 100),
      { ...response('unknown', 100), participantKey: undefined },
    ];
    expect(responseDeletionTargets(single, rows, new Set(['selected'])).map((row) => row.id))
      .toEqual(['old', 'selected']);
  });

  it.each(['wordCloud', 'openText'])('preserves independent multiple-entry %s submissions', (kind) => {
    const rows = [response('old', 100), response('selected', 200), response('newer', 300)];
    expect(responseDeletionTargets({ kind, allowMultiple: true }, rows, new Set(['selected'])))
      .toEqual([rows[1]]);
  });
});

it('normalizes cloud deletion targets exactly like aggregation', () => {
  const rows = ['  Hello world ', 'hello WORLD', 'hello  world', 'hello world!', 'hello'];
  const matching = rows.filter((text) => normalizeWordCloudText(text) === normalizeWordCloudText('Hello world'));
  expect(matching).toHaveLength(2);
  expect(buildWordCloud(rows.map((textValue) => ({ textValue })))).toHaveLength(4);
});
