import { describe, expect, it, vi } from 'vitest';
import {
  generateBrief, generatedReportIssues, modelReportContent,
  reportGenerationPrompt, reportWordCount, validateReportContent,
} from '../rayfin/functions/src/report-document';
import { reportDocument } from '../src/lib/report';
import { conciseAiTourReport } from './fixtures/concise-report';

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
  it('keeps manual editing independent of generated style and word limits', () => {
    const manual = `An em dash \u2014 and ${'word '.repeat(400)}`.trim();
    expect(reportWordCount(manual)).toBeGreaterThan(300);
    expect(validateReportContent(manual)).toBe(manual);
  });

  describe('concise generated reports', () => {
    const minimal = 'Met the team.\n\n## Key takeaways\n- Access approval is still pending.';

    it('accepts a short report with two or three takeaways and optional next steps', async () => {
      expect(generatedReportIssues(conciseAiTourReport)).toEqual([]);
      const two = 'Met the team.\n\n## Key takeaways\n- Access is pending.\n- Documentation needs review.';
      expect(generatedReportIssues(two)).toEqual([]);
      expect(generatedReportIssues(`${two}\n\n## Next steps\n- Send the requested access checklist.`)).toEqual([]);
      const request = vi.fn().mockResolvedValue(response(conciseAiTourReport));
      await expect(generateBrief(request)).resolves.toBe(conciseAiTourReport);
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('does not require padding sparse notes or an invented next-step section', () => {
      expect(generatedReportIssues(minimal)).toEqual([]);
      const prompt = reportGenerationPrompt();
      expect(prompt).toContain('Aim for 250-300 words');
      expect(prompt).toContain('never pad or invent facts');
      expect(prompt).toContain('If only one is supported, use one rather than inventing another');
      expect(prompt).toContain('only when the notes mention actual follow-ups');
      expect(prompt).toContain('an idea is not a commitment');
      expect(prompt).toContain('Use active voice');
      expect(prompt).toContain('Do not state the same fact in both');
      expect(prompt).toContain('one customer is not an industry trend');
    });

    it('requests selective bold emphasis and preserves it in generated content', async () => {
      const prompt = reportGenerationPrompt();
      expect(prompt).toContain('Use Markdown bold (**...**) sparingly');
      expect(prompt).toContain('not whole sentences, entire bullets, or generic labels');
      expect(prompt).toContain('Include important qualifications');
      const text = 'Met the team.\n\n## Key takeaways\n- **Access approval is still pending**.\n\n## Next steps\n- **Send the access checklist**.';
      const request = vi.fn().mockResolvedValue(response(text));
      expect(generatedReportIssues(text)).toEqual([]);
      expect(reportWordCount(text)).toBe(reportWordCount(text.replaceAll('**', '')));
      await expect(generateBrief(request)).resolves.toBe(text);
      expect(request).toHaveBeenCalledOnce();
    });

    it('counts heading text, ignores list markers, and accepts 300 but not 301 words', () => {
      const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
      const exact = `${words(56)}.\n\n## Key takeaways\n- ${words(70)}.\n- ${words(70)}.\n- ${words(70)}.\n\n## Next steps\n- ${words(30)}.`;
      expect(reportWordCount(exact)).toBe(300);
      expect(generatedReportIssues(exact)).toEqual([]);
      expect(generatedReportIssues(`${exact} Extra.`)).toEqual([
        'Use at most 300 words, including headings; received 301.',
      ]);
    });

    it('accepts 250 words without the old 30-word section caps', () => {
      const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
      const text = `${words(48)}.\n\n## Key takeaways\n- ${words(100)}.\n- ${words(100)}.`;
      expect(reportWordCount(text)).toBe(250);
      expect(generatedReportIssues(text)).toEqual([]);
    });

    it.each([
      ['em dash', minimal.replace('Met the team.', 'Met the team \u2014 access is pending.'), 'em dashes'],
      ['missing heading', 'Met the team.\n- Access is pending.', 'Key takeaways'],
      ['four takeaways', `${minimal}\n- Two.\n- Three.\n- Four.`, '1-3'],
      ['empty takeaways', 'Met the team.\n\n## Key takeaways', '1-3'],
      ['extra section', `${minimal}\n\n## Conclusion\nGood trip.`, 'flat'],
      ['multiple opening paragraphs', `Met the team.\n\nUseful discussion.\n\n## Key takeaways\n- Access is pending.`, 'opening paragraph'],
      ['nested bullets', `${minimal}\n  - Nested detail.`, 'flat'],
      ['three actions', `${minimal}\n\n## Next steps\n- One.\n- Two.\n- Three.`, '1-2'],
      ['empty actions', `${minimal}\n\n## Next steps`, '1-2'],
      ['long summary', `${'detail '.repeat(61)}\n\n## Key takeaways\n- Access is pending.`, '60 words'],
      ['long bullet', `${minimal} ${'detail '.repeat(100)}`, '100 words'],
      ['oversized content', `${minimal} ${'x'.repeat(2501)}`, '2500 characters'],
    ])('rejects %s with actionable correction feedback', (_name, text, issue) => {
      expect(generatedReportIssues(text).join(' ')).toContain(issue);
    });

    it('uses one specific corrective retry without altering the model response itself', async () => {
      const first = minimal.replace('Met the team.', 'Met the team \u2014 access is pending.');
      const request = vi.fn().mockResolvedValueOnce(response(first)).mockResolvedValueOnce(response(minimal));
      await expect(generateBrief(request)).resolves.toBe(minimal);
      expect(request.mock.calls[0]).toEqual([]);
      expect(request.mock.calls[1][0]).toContain('Remove em dashes');
      expect(reportGenerationPrompt(request.mock.calls[1][0])).toContain('Correct these issues: Remove em dashes');
    });

    it('fails after a single correction and never truncates or sanitizes into success', async () => {
      const request = vi.fn().mockResolvedValue(response('a'.repeat(2501)));
      await expect(generateBrief(request)).rejects.toThrow('saved draft has not been replaced');
      expect(request).toHaveBeenCalledTimes(2);
    });

    it('does not repair incomplete responses by pretending they are complete', async () => {
      const request = vi.fn().mockResolvedValue(response(minimal, 'length'));
      await expect(generateBrief(request)).rejects.toThrow('incomplete');
      expect(request).toHaveBeenCalledTimes(1);
    });
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
