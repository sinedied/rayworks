export const REPORT_MAX_LENGTH = 2500;

export function validateReportContent(value: string): string {
  const content = value.trim();
  if (!content) throw new Error('Write a report before saving or finalizing.');
  if (content.length > REPORT_MAX_LENGTH) {
    throw new Error(`The report must be ${REPORT_MAX_LENGTH.toLocaleString('en')} characters or fewer.`);
  }
  return content;
}

export function modelReportContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || !('choices' in payload)) {
    throw new Error('Azure Foundry returned an invalid report response.');
  }
  const choices = payload.choices;
  if (!Array.isArray(choices)) {
    throw new Error('Azure Foundry returned no report.');
  }
  const choice: unknown = choices[0];
  if (!choice || typeof choice !== 'object' || !('finish_reason' in choice)) {
    throw new Error('Azure Foundry returned no report.');
  }
  if (choice.finish_reason !== 'stop') {
    throw new Error('The generated report was incomplete. Please generate it again.');
  }
  if (!('message' in choice) || !choice.message || typeof choice.message !== 'object'
    || !('content' in choice.message) || typeof choice.message.content !== 'string') {
    throw new Error('Azure Foundry returned no report text.');
  }
  const content = choice.message.content.trim()
    .replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i, '$1').trim();
  if (!content) throw new Error('Azure Foundry returned an empty report.');
  return content;
}

export async function generateBrief(
  request: (shorten: boolean) => Promise<unknown>
): Promise<string> {
  const first = modelReportContent(await request(false));
  if (first.length <= REPORT_MAX_LENGTH) return validateReportContent(first);
  return validateReportContent(modelReportContent(await request(true)));
}
