export { REPORT_MAX_LENGTH, validateReportContent } from '../../rayfin/functions/src/report-document';

export function reportDocument(report: {
  content?: string | null;
  summary?: string | null;
  keyTakeaways?: string | null;
}): string {
  if (report.content != null) return report.content;
  // Legacy fields were plain text, not Markdown. Preserve their literal content.
  const literal = (value: string) => value.replace(/([\\`*_{}[\]<>()#+\-.!|~>])/g, '\\$1');
  return [
    report.summary ? `## Summary\n\n${literal(report.summary)}` : '',
    report.keyTakeaways ? `## Key takeaways\n\n${literal(report.keyTakeaways)}` : '',
  ].filter(Boolean).join('\n\n');
}
