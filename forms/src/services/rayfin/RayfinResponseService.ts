import type { Answer } from '../../../rayfin/data/Answer';
import type { FormResponse } from '../../../rayfin/data/FormResponse';
import {
  AnswerDraft,
  IResponseService,
  SubmissionResult,
} from '../interfaces/IResponseService';

import { getRayfinClient } from './RayfinClientService';

const RESPONSE_FIELDS = [
  'id',
  'submittedAt',
  'respondentEmail',
  'form_id',
  'respondent_id',
  'owner_id',
] as const;

const ANSWER_FIELDS = [
  'id',
  'value',
  'fieldLabel',
  'position',
  'response_id',
  'field_id',
  'respondent_id',
  'owner_id',
] as const;

/**
 * DAB rejects the *read-back* of a row an anonymous caller just wrote, even though the write
 * itself committed. The error text states the mutation "was successful", which is what
 * distinguishes it from a genuine failure.
 */
export function isWriteSucceededButUnreadable(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('was successful') &&
    error.message.includes('read permissions')
  );
}

/**
 * Creates a row, tolerating the anonymous read-back denial above. IDs are generated client-side
 * so callers never depend on the server echoing the created row.
 */
async function createTolerantly(
  create: () => Promise<unknown>,
  onUnreadable: () => void
): Promise<void> {
  try {
    await create();
  } catch (error) {
    if (isWriteSucceededButUnreadable(error)) {
      onUnreadable();
      return;
    }
    throw error;
  }
}

export class RayfinResponseService implements IResponseService {
  async submitResponse(
    form: { id: string; owner_id: string },
    answers: AnswerDraft[]
  ): Promise<SubmissionResult> {
    const client = getRayfinClient();
    // Anonymous respondents have no session; identity fields stay empty for them.
    const session = client.auth.getSession();
    const respondentId = session.user?.id;
    const respondentEmail = session.user?.email;

    // IDs are client-generated: an anonymous caller cannot read back what it just wrote.
    const responseId = crypto.randomUUID();
    const responsePayload: FormResponse = {
      id: responseId,
      submittedAt: new Date(),
      respondentEmail: respondentEmail ?? undefined,
      form_id: form.id,
      respondent_id: respondentId ?? undefined,
      owner_id: form.owner_id,
    };

    let response = responsePayload;
    await createTolerantly(
      async () => {
        response = await client.data.FormResponse.create(responsePayload);
      },
      () => {
        response = responsePayload;
      }
    );

    const created: Answer[] = [];
    for (const answer of answers) {
      const answerPayload: Answer = {
        id: crypto.randomUUID(),
        value: Array.isArray(answer.value)
          ? JSON.stringify(answer.value)
          : answer.value,
        fieldLabel: answer.fieldLabel,
        position: answer.position,
        response_id: responseId,
        field_id: answer.fieldId,
        respondent_id: respondentId ?? undefined,
        owner_id: form.owner_id,
      };

      let stored = answerPayload;
      await createTolerantly(
        async () => {
          stored = await client.data.Answer.create(answerPayload);
        },
        () => {
          stored = answerPayload;
        }
      );
      created.push(stored);
    }

    return { response, answers: created };
  }

  async getResponsesForForm(formId: string): Promise<FormResponse[]> {
    const client = getRayfinClient();
    const responses = await client.data.FormResponse.select([
      ...RESPONSE_FIELDS,
    ])
      .where({ form_id: { eq: formId } })
      .orderBy({ submittedAt: 'desc' })
      .execute();

    return responses;
  }

  async getAnswersForForm(formId: string): Promise<Answer[]> {
    const responses = await this.getResponsesForForm(formId);
    return this.getAnswersForResponses(responses.map((r) => r.id));
  }

  /** Fetches answers for a known set of responses using a single `in` filter. */
  async getAnswersForResponses(responseIds: string[]): Promise<Answer[]> {
    if (responseIds.length === 0) {
      return [];
    }

    const client = getRayfinClient();
    return client.data.Answer.select([...ANSWER_FIELDS])
      .where({ response_id: { in: responseIds } })
      .execute();
  }

  async deleteResponse(responseId: string): Promise<void> {
    const client = getRayfinClient();
    const answers = await client.data.Answer.select(['id', 'response_id'])
      .where({ response_id: { eq: responseId } })
      .execute();

    await Promise.all(
      answers.map((answer) => client.data.Answer.delete({ id: answer.id }))
    );
    await client.data.FormResponse.delete({ id: responseId });
  }
}
