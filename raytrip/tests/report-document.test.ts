import { describe, expect, it, vi } from 'vitest';
import { generateBrief, modelReportContent, validateReportContent } from '../rayfin/functions/src/report-document';
import { reportDocument } from '../src/lib/report';

const response = (content: string, finish_reason = 'stop') => ({
  choices: [{ finish_reason, message: { content } }],
});

describe('single report document', () => {
  it('accepts exactly 2500 characters and rejects empty or over-limit content', () => {
    expect(validateReportContent('x'.repeat(2500))).toHaveLength(2500);
    expect(() => validateReportContent(' \n ')).toThrow();
    expect(() => validateReportContent('x'.repeat(2501))).toThrow('2,500');
  });
  it('validates output shape, completion, and outer fences', () => {
    expect(modelReportContent(response('```markdown\n## Summary\nText\n```'))).toBe('## Summary\nText');
    expect(() => modelReportContent(response('partial', 'length'))).toThrow('incomplete');
    expect(() => modelReportContent(response(''))).toThrow('empty');
    expect(() => modelReportContent({})).toThrow('invalid');
  });
  it('shortens at most once and never silently truncates', async () => {
    const request = vi.fn().mockResolvedValueOnce(response('a'.repeat(2501))).mockResolvedValueOnce(response('## Summary\nConcise'));
    await expect(generateBrief(request)).resolves.toBe('## Summary\nConcise');
    expect(request.mock.calls).toEqual([[false], [true]]);
    const tooLong = vi.fn().mockResolvedValue(response('a'.repeat(2501)));
    await expect(generateBrief(tooLong)).rejects.toThrow('2,500');
    expect(tooLong).toHaveBeenCalledTimes(2);
  });
  it('keeps long legacy reports and prefers new content', () => {
    const old = { summary: 's'.repeat(4000), keyTakeaways: 't'.repeat(4000) };
    expect(reportDocument(old)).toContain(old.summary);
    expect(reportDocument(old)).toContain(old.keyTakeaways);
    expect(reportDocument({ ...old, content: 'New' })).toBe('New');
    expect(reportDocument({})).toBe('');
    expect(reportDocument({ summary: '<script>bad</script>' })).toContain('\\<script\\>');
  });
});
